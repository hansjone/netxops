/**
 * Shared settings-form face used by the Plugins card.
 *
 * DSH ≤0.1.5 exposes `ctx.settingsScope.bind({ namespace })`.
 * DSH ≥0.1.7 / 0.2.0 exposes `ctx.configForms.get(entryId)`.
 * Snapshot + set/unset/subscribe shapes match, so the card stays agnostic.
 */

export interface SettingsFormSnapshot<T> {
  status: string
  value?: T
  base?: unknown
  user?: unknown
  revision?: number
  writable: boolean
  mode?: string
}

export interface SettingsFormScope<T> {
  getSnapshot(): SettingsFormSnapshot<T>
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<boolean | void>
  unset(field: string): Promise<boolean | void>
}
