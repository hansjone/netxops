/**
 * Remote netx `/mcp` tool descriptors.
 *
 * Plugin switches (groups / disabledTools / readOnlyOnly) only control what the
 * model sees — they are **not** a security boundary. Authorization and CLI
 * guards live on the netx server.
 */

import type { NetxCapabilityGroupId } from './capability-groups.ts'

/** Model-facing prefix kept stable across the REST→MCP migration. */
export const NETX_TOOL_PREFIX = 'netx__'

/** One tool from `tools/list` (server name has no prefix). */
export interface NetxMcpToolDescriptor {
  /** Server tool name, e.g. `queryNmsAlarms`. */
  name: string
  description: string
  inputSchema: Record<string, unknown>
  /** From `annotations.readOnlyHint`; missing → treat as writable. */
  readOnlyHint: boolean
  /** From `_meta.netx.group`; unknown → excluded from registration. */
  group: NetxCapabilityGroupId | undefined
}

export type NetxMcpConnectionPhase = 'idle' | 'connecting' | 'connected' | 'error' | 'offline'

/** Cached catalog + last connect outcome for the Plugins card. */
export interface NetxMcpCatalogState {
  phase: NetxMcpConnectionPhase
  /** Absolute `/mcp` URL last used for a successful or failed refresh. */
  mcpUrl: string
  tools: readonly NetxMcpToolDescriptor[]
  /** Human-readable connect / list failure; empty when ok. */
  error: string
  /** ISO timestamp of the last successful tools/list (cache may be stale when offline). */
  listedAt: string | null
  /** True when the in-memory list came from a previous successful fetch while currently offline. */
  fromCache: boolean
}

export function publicToolName(serverName: string): string {
  return `${NETX_TOOL_PREFIX}${serverName}`
}

export function serverToolName(publicName: string): string {
  return publicName.startsWith(NETX_TOOL_PREFIX)
    ? publicName.slice(NETX_TOOL_PREFIX.length)
    : publicName
}
