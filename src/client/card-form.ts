/**
 * Shared staged-form model for the Netx Ops Plugins settings card.
 * Self-contained (cannot value-import ui-settings-plugins — client bundle purity).
 */

import { normalizeApiUrl } from '../netx/http.ts'
import { parsePresetIds } from '../netx/capability-groups.ts'
import type { SettingsFormScope, SettingsFormSnapshot } from './settings-form.ts'
import { createSnapshotStore, type SnapshotStore } from './snapshot-store.ts'

export type FieldWrite = { kind: 'set'; value: unknown } | { kind: 'clear' }

export interface CardFieldSpec {
  field: string
  format: (value: unknown) => string
  parse: (text: string) => FieldWrite | undefined
}

export interface CardSecretSpec {
  field: string
  write: (text: string) => Promise<boolean>
}

export interface CardFieldState {
  text: string
  overridden: boolean
  invalid: boolean
}

export interface CardShell {
  available: boolean
  writable: boolean
  dirty: boolean
  invalid: boolean
  saving: boolean
  failed: boolean
}

export interface CardActions {
  edit: (field: string, text: string) => void
  resetField: (field: string) => void
  save: () => void
  discard: () => void
}

interface StagedEdit {
  text: string
  clear: boolean
}

interface PlannedWrite {
  field: string
  run: (() => Promise<boolean>) | undefined
}

export function textField(field: string): CardFieldSpec {
  return {
    field,
    format: value => typeof value === 'string' ? value : '',
    parse: (text) => {
      const trimmed = text.trim()
      return trimmed === '' ? { kind: 'clear' } : { kind: 'set', value: trimmed }
    },
  }
}

/** Empty selection must override a profile's target list rather than restore it. */
export function presetIdsField(field: string): CardFieldSpec {
  return {
    field,
    format: value => typeof value === 'string' ? value : '',
    parse: text => ({ kind: 'set', value: parsePresetIds(text).join(',') }),
  }
}

/**
 * http(s) API root — rejects credentials-in-URL and non-http schemes.
 * Empty clears to schema default; save stores the normalized URL.
 */
export function apiUrlField(field: string): CardFieldSpec {
  return {
    field,
    format: value => typeof value === 'string' ? value : '',
    parse: (text) => {
      const trimmed = text.trim()
      if (trimmed === '') return { kind: 'clear' }
      const normalized = normalizeApiUrl(trimmed)
      if (!normalized.ok) return undefined
      return { kind: 'set', value: normalized.url }
    },
  }
}

/** Boolean settings field rendered as a checkbox (stores true / clears when false). */
export function booleanField(field: string): CardFieldSpec {
  return {
    field,
    format: value => (value === true ? 'true' : 'false'),
    parse: (text) => {
      const normalized = text.trim().toLowerCase()
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return { kind: 'set', value: true }
      }
      if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === '') {
        return { kind: 'clear' }
      }
      return undefined
    },
  }
}

/**
 * Boolean that persists `false` explicitly (use when schema default is `true`).
 * Clearing would restore the default and make "off" impossible.
 */
export function booleanFieldPersistFalse(field: string): CardFieldSpec {
  return {
    field,
    format: value => (value === true ? 'true' : 'false'),
    parse: (text) => {
      const normalized = text.trim().toLowerCase()
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return { kind: 'set', value: true }
      }
      if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === '') {
        return { kind: 'set', value: false }
      }
      return undefined
    },
  }
}

export class CardForm<T> {
  private readonly specs: Map<string, CardFieldSpec>
  private readonly secretSpecs: Map<string, CardSecretSpec>
  private readonly staged = new Map<string, StagedEdit>()
  private readonly listeners = new Set<() => void>()
  private saving = false
  private failed = false
  private saveQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly scope: SettingsFormScope<T>,
    specs: CardFieldSpec[],
    secrets: CardSecretSpec[] = [],
  ) {
    this.specs = new Map(specs.map(spec => [spec.field, spec]))
    this.secretSpecs = new Map(secrets.map(spec => [spec.field, spec]))
    scope.subscribe(() => { this.publish() })
  }

  bind<S>(project: () => S): SnapshotStore<S> {
    const store = createSnapshotStore(project())
    this.listeners.add(() => { store.set(project()) })
    return store
  }

  shell(): CardShell {
    const snapshot = this.scope.getSnapshot()
    const plan = this.plan()
    let committedInvalid = false
    for (const field of this.specs.keys()) {
      if (this.field(field).invalid) {
        committedInvalid = true
        break
      }
    }
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      dirty: plan.length > 0,
      invalid: committedInvalid || plan.some(item => item.run === undefined),
      saving: this.saving,
      failed: this.failed,
    }
  }

  field(field: string): CardFieldState {
    const staged = this.staged.get(field)
    if (this.secretSpecs.has(field)) {
      return { text: staged?.text ?? '', overridden: false, invalid: false }
    }
    const spec = this.spec(field)
    if (staged === undefined) {
      const text = spec.format(this.sectionValue(field))
      // Surface committed bad values (e.g. file:// apiUrl) so Save stays blocked
      // until the operator fixes them — not only while the field is staged.
      const write = text.trim() === '' ? { kind: 'clear' as const } : spec.parse(text)
      return {
        text,
        overridden: this.stored(field),
        invalid: text.trim() !== '' && write === undefined,
      }
    }
    const write = staged.clear ? { kind: 'clear' as const } : spec.parse(staged.text)
    return {
      text: staged.text,
      overridden: write?.kind === 'set',
      invalid: write === undefined,
    }
  }

  actions(): CardActions {
    return {
      edit: (field, text) => { this.stage(field, { text, clear: false }) },
      resetField: (field) => {
        this.stage(field, { text: this.spec(field).format(this.baseValue(field)), clear: true })
      },
      save: () => { void this.save() },
      discard: () => {
        if (this.staged.size === 0 && !this.failed) return
        this.staged.clear()
        this.failed = false
        this.publish()
      },
    }
  }

  /** Serialize writes and save only requested fields for immediate publication toggles. */
  save(fields?: readonly string[]): Promise<void> {
    const task = this.saveQueue.then(() => this.saveNow(fields))
    this.saveQueue = task.catch(() => {})
    return task
  }

  private async saveNow(fields?: readonly string[]): Promise<void> {
    const snapshot = this.snapshotOf()
    if (snapshot.status !== 'ready' || !snapshot.writable) {
      this.failed = true
      this.publish()
      return
    }
    const staged = new Map([...this.staged].filter(([field]) => !fields || fields.includes(field)))
    const plan = this.plan().filter(item => !fields || fields.includes(item.field))
    const writes = plan.flatMap(item => item.run === undefined ? [] : [item.run])
    if (writes.length !== plan.length) return
    this.saving = true
    this.failed = false
    this.publish()
    let landed = true
    try {
      for (const write of writes) landed = await write() && landed
    } catch {
      landed = false
    } finally {
      // A newer edit made during a write remains staged for the next queued save.
      if (landed) {
        for (const [field, edit] of staged) {
          if (this.staged.get(field) === edit) this.staged.delete(field)
        }
      }
      this.saving = false
      this.failed = !landed
      this.publish()
    }
  }

  private plan(): PlannedWrite[] {
    const plan: PlannedWrite[] = []
    for (const [field, staged] of this.staged) {
      const secret = this.secretSpecs.get(field)
      if (secret !== undefined) {
        const value = staged.text.trim()
        if (value !== '') plan.push({ field, run: () => secret.write(value) })
        continue
      }
      const spec = this.spec(field)
      if (staged.clear) {
        if (this.stored(field)) plan.push({ field, run: () => this.clear(field) })
        continue
      }
      if (staged.text === spec.format(this.sectionValue(field))) continue
      const write = spec.parse(staged.text)
      if (write === undefined) plan.push({ field, run: undefined })
      else if (write.kind === 'clear') plan.push({ field, run: () => this.clear(field) })
      else plan.push({ field, run: () => this.store(field, write.value) })
    }
    return plan
  }

  private async clear(field: string): Promise<boolean> {
    await this.scope.unset(field)
    return !this.stored(field)
  }

  private async store(field: string, value: unknown): Promise<boolean> {
    await this.scope.set(field, value)
    // `settings.mutate` can settle without throwing on a refused write; confirm
    // via the resolved section value (user layer alone can lag or omit keys).
    return this.sectionValue(field) === value || this.userLayer()?.[field] === value
  }

  private stage(field: string, edit: StagedEdit): void {
    this.staged.set(field, edit)
    this.failed = false
    this.publish()
  }

  private spec(field: string): CardFieldSpec {
    const spec = this.specs.get(field)
    if (spec === undefined) throw new Error(`netxops card has no field ${field}`)
    return spec
  }

  private snapshotOf(): SettingsFormSnapshot<T> {
    return this.scope.getSnapshot()
  }

  private sectionValue(field: string): unknown {
    return (this.snapshotOf().value as Record<string, unknown> | undefined)?.[field]
  }

  private baseValue(field: string): unknown {
    return (this.snapshotOf().base as Record<string, unknown> | undefined)?.[field]
  }

  private userLayer(): Record<string, unknown> | undefined {
    return this.snapshotOf().user as Record<string, unknown> | undefined
  }

  private stored(field: string): boolean {
    const user = this.userLayer()
    return user !== undefined && Object.hasOwn(user, field)
  }

  private publish(): void {
    for (const listener of this.listeners) listener()
  }
}
