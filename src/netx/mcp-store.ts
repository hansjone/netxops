/**
 * Process-local MCP catalog cache shared by host + preset tool mounts.
 *
 * Uses Symbol.for on globalThis so host / agent-tools bundles share one store.
 */

import { listMcpTools, mcpEndpointUrl, McpRemoteError } from './mcp-remote.ts'
import type { NetxMcpCatalogState, NetxMcpToolDescriptor } from './mcp-types.ts'

type Listener = () => void

interface Store {
  state: NetxMcpCatalogState
  listeners: Set<Listener>
  /** Generation counter so stale refreshes do not clobber newer ones. */
  generation: number
}

const STORE_KEY = Symbol.for('dsh-netxops.mcp-catalog-store')

const EMPTY: NetxMcpCatalogState = Object.freeze({
  phase: 'idle',
  mcpUrl: '',
  tools: Object.freeze([]),
  error: '',
  listedAt: null,
  fromCache: false,
})

function store(): Store {
  const root = globalThis as typeof globalThis & { [STORE_KEY]?: Store }
  let current = root[STORE_KEY]
  if (current === undefined) {
    current = { state: EMPTY, listeners: new Set(), generation: 0 }
    root[STORE_KEY] = current
  }
  return current
}

function notify(): void {
  for (const listener of [...store().listeners]) {
    try { listener() } catch (error) { console.error('netxops: mcp catalog subscriber failed', error) }
  }
}

function publish(next: NetxMcpCatalogState): void {
  store().state = next
  notify()
}

export function getMcpCatalogState(): NetxMcpCatalogState {
  return store().state
}

export function getMcpCatalogTools(): readonly NetxMcpToolDescriptor[] {
  return store().state.tools
}

export function watchMcpCatalog(listener: Listener): () => void {
  const state = store()
  state.listeners.add(listener)
  return () => { state.listeners.delete(listener) }
}

export function resetMcpCatalog(): void {
  store().generation += 1
  publish(EMPTY)
}

export interface RefreshMcpCatalogInput {
  apiUrl: string
  token: string
  lang?: string
  timeoutMs?: number
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}

/**
 * Pull tools/list. On failure keep the previous tool list (fromCache) and
 * surface the error for the Plugins card — never throw to the Host apply path.
 */
export async function refreshMcpCatalog(input: RefreshMcpCatalogInput): Promise<NetxMcpCatalogState> {
  const mcpUrl = mcpEndpointUrl(input.apiUrl)
  const state = store()
  const gen = ++state.generation
  const previous = state.state

  if (!mcpUrl) {
    const next: NetxMcpCatalogState = {
      phase: 'error',
      mcpUrl: '',
      tools: previous.tools,
      error: 'apiUrl empty',
      listedAt: previous.listedAt,
      fromCache: previous.tools.length > 0,
    }
    if (gen === store().generation) publish(next)
    return next
  }

  publish({
    phase: 'connecting',
    mcpUrl,
    tools: previous.tools,
    error: '',
    listedAt: previous.listedAt,
    fromCache: previous.tools.length > 0,
  })

  try {
    const tools = await listMcpTools({
      mcpUrl,
      token: input.token,
      lang: input.lang,
      timeoutMs: input.timeoutMs,
      signal: input.signal,
      fetchImpl: input.fetchImpl,
    })
    if (gen !== store().generation) return store().state
    const next: NetxMcpCatalogState = {
      phase: 'connected',
      mcpUrl,
      tools: Object.freeze([...tools]),
      error: '',
      listedAt: new Date().toISOString(),
      fromCache: false,
    }
    publish(next)
    return next
  } catch (error) {
    if (gen !== store().generation) return store().state
    const message = error instanceof McpRemoteError
      ? error.message
      : error instanceof Error
        ? error.message
        : String(error)
    const next: NetxMcpCatalogState = {
      phase: previous.tools.length > 0 ? 'offline' : 'error',
      mcpUrl,
      tools: previous.tools,
      error: message,
      listedAt: previous.listedAt,
      fromCache: previous.tools.length > 0,
    }
    publish(next)
    return next
  }
}
