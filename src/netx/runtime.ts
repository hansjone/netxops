/**
 * Process-local Netx Ops connection snapshot shared between the host settings
 * bridge and the Ops-preset-scoped tool plugin.
 *
 * Uses `Symbol.for` on `globalThis` so host + agent-tools bundles share one store
 * even when Bun emits them as separate ESM files.
 */

import { DEFAULT_CAPABILITY_GROUPS } from './capability-groups.ts'
import { normalizeApiUrl } from './http.ts'
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
  if (JSON.stringify(state.connection) === JSON.stringify(next)) return
  state.connection = next
  for (const listener of [...state.listeners]) {
    try { listener() } catch (error) { console.error('netxops: connection subscriber failed', error) }
  }
}

/** @returns the last published connection, if any. */
export function getNetxConnection(): NetxToolConnection | undefined {
  return store().connection
}

/**
 * Fallback used when the Host bridge has not published yet (credentials still
 * pending, or host apply delayed). Publication stays disabled until the Host
 * publishes its actual policy, so a detached preset cannot bypass revocation.
 */
export function provisionalNetxConnection(): NetxToolConnection {
  const envUrl = process.env.NETX_API_URL?.trim() ?? ''
  const normalized = envUrl ? normalizeApiUrl(envUrl) : normalizeApiUrl('http://127.0.0.1:8890')
  return {
    toolsEnabled: false,
    apiUrl: normalized.ok ? normalized.url : 'http://127.0.0.1:8890',
    token: process.env.NETX_API_TOKEN?.trim() ?? '',
    lang: (typeof process.env.NETX_LANG === 'string' && process.env.NETX_LANG.trim()
      ? process.env.NETX_LANG.trim()
      : 'zh'),
    toolCallTimeoutMs: 120_000,
    groups: DEFAULT_CAPABILITY_GROUPS,
    groupKbInPreset: true,
    groupKbPublic: false,
  }
}

/** Live snapshot, or a disabled provisional connection until the Host is ready. */
export function requireNetxConnection(): NetxToolConnection {
  return getNetxConnection() ?? provisionalNetxConnection()
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
