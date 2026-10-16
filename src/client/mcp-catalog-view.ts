/**
 * Browser-side MCP catalog (RPC `tools.catalog` / `tools.refresh`).
 */

import type { AlarmPushRpcCall } from './alarm-push-status-view.ts'
import { NETXOPS_RPC_CHANNEL } from './tools-status-view.ts'

export const TOOLS_CATALOG_ENDPOINT = 'tools.catalog'
export const TOOLS_REFRESH_ENDPOINT = 'tools.refresh'

export interface McpToolRow {
  name: string
  description: string
  readOnlyHint: boolean
  group: 'ops' | 'topology' | 'bizMonitor' | null
}

export interface McpCatalogView {
  phase: string
  mcpUrl: string
  error: string
  listedAt: string | null
  fromCache: boolean
  tools: McpToolRow[]
}

const EMPTY: McpCatalogView = {
  phase: 'idle',
  mcpUrl: '',
  error: '',
  listedAt: null,
  fromCache: false,
  tools: [],
}

export function asMcpCatalogView(value: unknown): McpCatalogView {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return { ...EMPTY }
  const row = value as Record<string, unknown>
  const tools: McpToolRow[] = []
  if (Array.isArray(row.tools)) {
    for (const raw of row.tools) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
      const t = raw as Record<string, unknown>
      const name = typeof t.name === 'string' ? t.name : ''
      if (!name) continue
      const group = t.group === 'ops' || t.group === 'topology' || t.group === 'bizMonitor'
        ? t.group
        : null
      tools.push({
        name,
        description: typeof t.description === 'string' ? t.description : '',
        readOnlyHint: t.readOnlyHint === true,
        group,
      })
    }
  }
  return {
    phase: typeof row.phase === 'string' ? row.phase : 'idle',
    mcpUrl: typeof row.mcpUrl === 'string' ? row.mcpUrl : '',
    error: typeof row.error === 'string' ? row.error : '',
    listedAt: typeof row.listedAt === 'string' ? row.listedAt : null,
    fromCache: row.fromCache === true,
    tools,
  }
}

export async function fetchMcpCatalog(
  call: AlarmPushRpcCall,
  signal?: AbortSignal,
): Promise<McpCatalogView> {
  const result = await call(NETXOPS_RPC_CHANNEL, TOOLS_CATALOG_ENDPOINT, {}, signal)
  if (result !== null && typeof result === 'object' && (result as { ok?: boolean }).ok === true) {
    return asMcpCatalogView((result as { value?: unknown }).value)
  }
  return { ...EMPTY }
}

export async function refreshMcpCatalogRemote(
  call: AlarmPushRpcCall,
  signal?: AbortSignal,
): Promise<McpCatalogView> {
  const result = await call(NETXOPS_RPC_CHANNEL, TOOLS_REFRESH_ENDPOINT, {}, signal)
  if (result !== null && typeof result === 'object') {
    const row = result as { ok?: boolean; value?: unknown; error?: unknown }
    const view = asMcpCatalogView(row.value)
    if (typeof row.error === 'string' && row.error && !view.error) {
      return { ...view, error: row.error, phase: view.phase === 'connected' ? view.phase : 'error' }
    }
    return view
  }
  return { ...EMPTY, phase: 'error', error: 'refresh_failed' }
}
