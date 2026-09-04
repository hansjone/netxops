/**
 * Process-local Netx Ops connection snapshot shared between the host settings
 * bridge and the Ops-preset-scoped tool plugin.
 *
 * Uses `Symbol.for` on `globalThis` so host + agent-tools bundles share one store
 * even when Bun emits them as separate ESM files.
 */

import type { NetxToolConnection } from './tools.ts'

type Listener = () => void

interface Store {
  connection: NetxToolConnection | undefined
  listeners: Set<Listener>
}

const STORE_KEY = Symbol.for('dsh-netxops.connection-store')

function store(): Store {
  const root = globalThis as typeof globalThis & { [STORE_KEY]?: Store }
  let current = root[STORE_KEY]
  if (current === undefined) {
    current = { connection: undefined, listeners: new Set() }
    root[STORE_KEY] = current
  }
  return current
}

/**
 * Publish the latest API URL / token / lang / timeout for Ops tool mounts.
 * @param next - connection used by the next `registerNetxTools` call.
 */
export function publishNetxConnection(next: NetxToolConnection): void {
  const state = store()
  state.connection = next
  for (const listener of state.listeners) listener()
}

/** @returns the last published connection, if any. */
export function getNetxConnection(): NetxToolConnection | undefined {
  return store().connection
}

/**
 * Subscribe to connection publishes (settings / credential remounts).
 * @param listener - called synchronously after each publish.
 * @returns disposer.
 */
export function watchNetxConnection(listener: Listener): () => void {
  const state = store()
  state.listeners.add(listener)
  return () => { state.listeners.delete(listener) }
}
