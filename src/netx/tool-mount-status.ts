/** Process-wide mount inventory shared by independently bundled plugin entries. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export interface NetxToolMountStatus {
  id?: string
  version: string
  plane: string
  groups: string[]
  names: string[]
  count: number
  at: string
  error?: string
  source?: string
}
interface Store {
  mounts: Map<string, NetxToolMountStatus>
  contexts: WeakMap<object, number>
  sequence: number
}
const KEY = Symbol.for('dsh-netxops.mount-inventory')
function store(): Store {
  const root = globalThis as typeof globalThis & { [KEY]?: Store }
  return root[KEY] ??= { mounts: new Map(), contexts: new WeakMap(), sequence: 0 }
}
/** Stable registration-owner id, shared across independently built exports. */
export function getToolMountId(ctx: object, source: string): string {
  const state = store()
  let id = state.contexts.get(ctx)
  if (id === undefined) { id = ++state.sequence; state.contexts.set(ctx, id) }
  return `${source}:${id}`
}
/** Copies of every mount; remounting one preset never replaces another. */
export function getToolMountStatuses(): NetxToolMountStatus[] {
  return [...store().mounts.values()].map(row => ({ ...row, groups: [...row.groups], names: [...row.names] }))
}
/** Legacy singular view always prefers the Host mount. */
export function getToolMountStatus(): NetxToolMountStatus | undefined {
  const rows = getToolMountStatuses()
  return rows.find(row => row.plane === 'host') ?? rows.at(-1)
}
function persist(): void {
  try {
    const path = join(process.env.DSH_HOME?.trim() || join(homedir(), '.dsh'), 'netxops-mount-status.json')
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, `${JSON.stringify({ mount: getToolMountStatus() ?? null, mounts: getToolMountStatuses() }, null, 2)}\n`, 'utf8')
  } catch {
    // Diagnostics are best-effort on read-only installations.
  }
}
export function publishToolMountStatus(next: NetxToolMountStatus): void {
  store().mounts.set(next.id ?? next.source ?? next.plane, { ...next, groups: [...next.groups], names: [...next.names] })
  persist()
}
export function removeToolMountStatus(id: string): void {
  store().mounts.delete(id)
  persist()
}
export function resetToolMountStatus(): void {
  store().mounts.clear()
  persist()
}
