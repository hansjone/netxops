/**
 * Process-local MCP catalog cache shared by host + preset tool mounts.
 *
 * Uses Symbol.for on globalThis so host / agent-tools bundles share one store.
 * Skill files are mirrored under `$DSH_HOME/netxops-mcp-skills/<key>/`.
 */

import { fetchMcpCatalog, mcpEndpointUrl, McpRemoteError } from './mcp-remote.ts'
import type { NetxMcpCatalogState, NetxMcpToolDescriptor } from './mcp-types.ts'
import { replaceSkillsCache } from './skills-cache.ts'

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
 * Pull tools/list (+ skill resources). On failure keep the previous tool list
 * (fromCache) and leave the on-disk skill cache untouched. When tools succeed:
 * a server without resources → clear that address's skill cache; a failed
 * resources call → keep the last good cache.
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
    const fetched = await fetchMcpCatalog({
      mcpUrl,
      token: input.token,
      lang: input.lang,
      timeoutMs: input.timeoutMs,
      signal: input.signal,
      fetchImpl: input.fetchImpl,
    })
    if (gen !== store().generation) return store().state

    if (fetched.skills !== undefined) {
      // Includes "no resources capability" (empty list) → wipe stale files.
      replaceSkillsCache(input.apiUrl, fetched.skills, { token: input.token })
    } else {
      // Transient resources failure: keep the last good skill cache.
      console.warn('netxops: mcp skills pull failed, keeping cache — %s', fetched.skillsError)
    }

    const next: NetxMcpCatalogState = {
      phase: 'connected',
      mcpUrl,
      tools: Object.freeze([...fetched.tools]),
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
    // Offline: keep prior tools in memory and leave disk skill cache as-is.
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
