/**
 * Process-local knowledge-base snapshot shared between the host settings
 * bridge, RPC, and dynamic kb-context skill registration.
 *
 * Uses `Symbol.for` on `globalThis` so host + agent-tools bundles share one store
 * even when Bun emits them as separate ESM files.
 */

import type { KbSnapshot } from './kb-manifest.ts'
import { resolveKbPaths, unconfiguredKbSnapshot } from './kb-manifest.ts'
import { resolveKbLocalRoot } from './kb-local-path.ts'

type Listener = () => void

interface Store {
  snapshot: KbSnapshot
  listeners: Set<Listener>
}

const STORE_KEY = Symbol.for('dsh-netxops.kb-store')

const ENV_KEYS = [
  'KB_ROOT',
  'KB_LOCAL',
  'KB_OPERATOR',
  'KB_COUNTRY',
  'KB_VERSION',
  'KB_CONTENT',
  'KB_PATHS',
  'KB_STATUS',
] as const

function store(): Store {
  const root = globalThis as typeof globalThis & { [STORE_KEY]?: Store }
  let current = root[STORE_KEY]
  if (current === undefined) {
    current = { snapshot: unconfiguredKbSnapshot(), listeners: new Set() }
    root[STORE_KEY] = current
  }
  return current
}

/** @returns the last published KB snapshot. */
export function getKbContext(): KbSnapshot {
  const snap = store().snapshot
  return {
    ...snap,
    content: { ...snap.content },
    paths: { ...snap.paths },
  }
}

/**
 * Publish the latest KB snapshot for UI / skill remounts.
 * @param next - resolved snapshot from `resolveKbRoot`.
 * @param options.force - notify even when MANIFEST is unchanged (manual reload picks up
 *   edited SKILL.md / new local_skills / identity files on disk).
 */
export function publishKbContext(next: KbSnapshot, options: { force?: boolean } = {}): void {
  const state = store()
  if (!options.force && JSON.stringify(state.snapshot) === JSON.stringify(next)) return
  state.snapshot = {
    ...next,
    content: { ...next.content },
    paths: { ...next.paths },
  }
  for (const listener of [...state.listeners]) {
    try { listener() } catch (error) { console.error('netxops: knowledge subscriber failed', error) }
  }
}

/**
 * Subscribe to KB snapshot publishes (settings remounts).
 * @param listener - called synchronously after each publish.
 * @returns disposer.
 */
export function watchKbContext(listener: Listener): () => void {
  const state = store()
  state.listeners.add(listener)
  return () => { state.listeners.delete(listener) }
}

/**
 * Mirror the snapshot into `process.env.KB_*` for tools / future KB skill packs.
 * Clears identity fields when status is not `configured`.
 */
export function applyKbEnv(snapshot: KbSnapshot): void {
  for (const key of ENV_KEYS) {
    delete process.env[key]
  }
  process.env.KB_STATUS = snapshot.status
  if (snapshot.status !== 'configured') return
  process.env.KB_ROOT = snapshot.realRoot
  const local = resolveKbLocalRoot(snapshot)
  if (local) process.env.KB_LOCAL = local
  process.env.KB_OPERATOR = snapshot.operatorName
  process.env.KB_COUNTRY = snapshot.country
  process.env.KB_VERSION = snapshot.version
  process.env.KB_CONTENT = JSON.stringify(snapshot.content)
  process.env.KB_PATHS = JSON.stringify(
    Object.fromEntries(resolveKbPaths(snapshot).map(row => [row.key, row.absolute])),
  )
}

/** Reset store + env to unconfigured (plugin dispose). */
export function resetKbContext(): void {
  publishKbContext(unconfiguredKbSnapshot())
  applyKbEnv(unconfiguredKbSnapshot())
}
