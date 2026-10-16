/**
 * Browser-side Host tool-mount status (RPC `tools.status`).
 */

import type { AlarmPushRpcCall } from './alarm-push-status-view.ts'

/** Same channel as host `NETXOPS_RPC_CHANNEL`. */
export const NETXOPS_RPC_CHANNEL = '/netxops'

export const TOOLS_STATUS_ENDPOINT = 'tools.status'

export interface ToolsMountView {
  toolsEnabled: boolean
  mounts: Array<{ source: string; count: number; groups: string[]; plane: string; error?: string }>
  count: number
  version: string
  groups: string[]
  plane: string
  error?: string
  tokenConfigured: boolean | null
  apiUrl: string
  mcpPhase: string
  mcpError: string
  mcpFromCache: boolean
}

const EMPTY: ToolsMountView = {
  toolsEnabled: true,
  mounts: [],
  count: 0,
  version: '',
  groups: [],
  plane: '',
  tokenConfigured: null,
  apiUrl: '',
  mcpPhase: 'idle',
  mcpError: '',
  mcpFromCache: false,
}

/** Normalize host `tools.status` RPC value. */
export function asToolsMountView(value: unknown): ToolsMountView {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return { ...EMPTY }
  const row = value as Record<string, unknown>
  const mount = row.mount
  const connection = row.connection
  let count = 0
  let version = ''
  let groups: string[] = []
  let plane = ''
  let error: string | undefined
  if (mount !== null && typeof mount === 'object' && !Array.isArray(mount)) {
    const m = mount as Record<string, unknown>
    count = typeof m.count === 'number' ? m.count : 0
    version = typeof m.version === 'string' ? m.version : ''
    plane = typeof m.plane === 'string' ? m.plane : ''
    error = typeof m.error === 'string' ? m.error : undefined
    if (Array.isArray(m.groups)) {
      groups = m.groups.filter((g): g is string => typeof g === 'string')
    }
  }
  let tokenConfigured: boolean | null = null
  let apiUrl = ''
  if (connection !== null && typeof connection === 'object' && !Array.isArray(connection)) {
    const c = connection as Record<string, unknown>
    tokenConfigured = c.tokenConfigured === true
    apiUrl = typeof c.apiUrl === 'string' ? c.apiUrl : ''
  }
  const mounts: ToolsMountView['mounts'] = []
  const names = new Set<string>()
  if (Array.isArray(row.mounts)) {
    for (const raw of row.mounts) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
      const m = raw as Record<string, unknown>
      const entry = {
        source: typeof m.source === 'string' ? m.source : String(m.plane ?? ''),
        count: typeof m.count === 'number' ? m.count : 0,
        groups: Array.isArray(m.groups) ? m.groups.filter((g): g is string => typeof g === 'string') : [],
        plane: typeof m.plane === 'string' ? m.plane : '',
        error: typeof m.error === 'string' ? m.error : undefined,
      }
      mounts.push(entry)
      if (Array.isArray(m.names)) for (const name of m.names) if (typeof name === 'string') names.add(name)
      if (entry.error) error = entry.error
      if (typeof m.version === 'string' && m.version) version = m.version
    }
    count = names.size
    groups = [...new Set(mounts.flatMap(m => m.groups))]
  }
  const toolsEnabled = !(connection && typeof connection === 'object'
    && (connection as Record<string, unknown>).toolsEnabled === false)
  let mcpPhase = 'idle'
  let mcpError = ''
  let mcpFromCache = false
  if (row.mcp !== null && typeof row.mcp === 'object' && !Array.isArray(row.mcp)) {
    const mcp = row.mcp as Record<string, unknown>
    mcpPhase = typeof mcp.phase === 'string' ? mcp.phase : 'idle'
    mcpError = typeof mcp.error === 'string' ? mcp.error : ''
    mcpFromCache = mcp.fromCache === true
  }
  return {
    count, version, groups, plane, error, tokenConfigured, apiUrl, mounts, toolsEnabled,
    mcpPhase, mcpError, mcpFromCache,
  }
}

/** Fetch Host tool mount snapshot. */
export async function fetchToolsStatus(
  call: AlarmPushRpcCall,
  signal?: AbortSignal,
): Promise<ToolsMountView> {
  const result = await call(NETXOPS_RPC_CHANNEL, TOOLS_STATUS_ENDPOINT, {}, signal)
  if (result !== null && typeof result === 'object' && (result as { ok?: boolean }).ok === true) {
    return asToolsMountView((result as { value?: unknown }).value)
  }
  return { ...EMPTY }
}

/** Badge tone for the tools mount line. */
export function toolsMountTone(view: ToolsMountView | null): 'ok' | 'warn' | 'err' | 'neutral' {
  if (!view) return 'neutral'
  if (view.error || view.mcpPhase === 'error') return 'err'
  if (view.mcpPhase === 'offline' || view.mcpFromCache) return 'warn'
  if (!view.toolsEnabled) return 'neutral'
  if (view.count > 0) return 'ok'
  return 'warn'
}
