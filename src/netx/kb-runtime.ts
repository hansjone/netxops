/**
 * Process-local knowledge-base snapshot shared between the host settings
 * bridge, RPC, and dynamic kb-context skill registration.
 *
 * Uses `Symbol.for` on `globalThis` so host + agent-tools bundles share one store
 * even when Bun emits them as separate ESM files.
 */

import type { KbSnapshot } from './kb-manifest.ts'
import { unconfiguredKbSnapshot } from './kb-manifest.ts'

type Listener = () => void

interface Store {
  snapshot: KbSnapshot
  listeners: Set<Listener>
}

const STORE_KEY = Symbol.for('dsh-netxops.kb-store')

const ENV_KEYS = [
  'KB_ROOT',
  'KB_OPERATOR',
  'KB_COUNTRY',
  'KB_VERSION',
  'KB_CONTENT',
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
  return { ...store().snapshot, content: { ...store().snapshot.content } }
}

/**
 * Publish the latest KB snapshot for UI / skill remounts.
 * @param next - resolved snapshot from `resolveKbRoot`.
 */
export function publishKbContext(next: KbSnapshot): void {
  const state = store()
  state.snapshot = {
    ...next,
    content: { ...next.content },
  }
  for (const listener of state.listeners) listener()
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
  process.env.KB_OPERATOR = snapshot.operatorName
  process.env.KB_COUNTRY = snapshot.country
  process.env.KB_VERSION = snapshot.version
  process.env.KB_CONTENT = JSON.stringify(snapshot.content)
}

/** Reset store + env to unconfigured (plugin dispose). */
export function resetKbContext(): void {
  publishKbContext(unconfiguredKbSnapshot())
  applyKbEnv(unconfiguredKbSnapshot())
}
