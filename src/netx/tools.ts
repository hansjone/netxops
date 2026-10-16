/**
 * Register native DSH tools (`netx__*`) by forwarding to netx `/mcp`.
 *
 * Tool visibility (groups / disabledTools / readOnlyOnly) is an operator UX
 * control only — not a security boundary. Server RBAC still applies on every
 * tools/call.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { NetxCapabilityGroupId, NetxCapabilityGroups } from './capability-groups.ts'
import { resolveEnabledTools } from './mcp-catalog.ts'
import { callMcpTool, mcpContentText, mcpEndpointUrl } from './mcp-remote.ts'
import { parametersFromInputSchema } from './mcp-schema.ts'
import { getMcpCatalogTools } from './mcp-store.ts'
import { publicToolName, type NetxMcpToolDescriptor } from './mcp-types.ts'
import { getNetxConnection } from './runtime.ts'
import { getToolMountId, publishToolMountStatus, removeToolMountStatus } from './tool-mount-status.ts'

function packageVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as { version?: string }
    return typeof pkg.version === 'string' ? pkg.version : '0'
  } catch {
    return '0'
  }
}

export interface NetxToolConnection {
  toolsEnabled?: boolean
  groupKbPresets?: string
  apiUrl: string
  token: string
  lang: string
  toolCallTimeoutMs: number
  /** Capability-group exposure; omitted → package defaults. */
  groups?: NetxCapabilityGroups
  /**
   * Server tool names turned off by the operator (opt-out). New server tools
   * follow the group switch unless listed here.
   */
  disabledTools?: readonly string[]
  /** When true, only register tools with readOnlyHint === true. */
  readOnlyOnly?: boolean
  /**
   * Mount operator-subset `_skills/kb-*` into the Netx Ops preset (default true).
   * Gated also by KB configured + content.hasSkills.
   */
  groupKbInPreset?: boolean
  /** Mount kb pack skills on the host public skill layer (default false). */
  groupKbPublic?: boolean
}

function renderMcpResult(_args: unknown, value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const row = value as { text?: unknown; content?: unknown[] }
    if (typeof row.text === 'string' && row.text.length > 0) {
      return [{ type: 'text' as const, text: row.text }]
    }
    if (Array.isArray(row.content)) {
      return [{ type: 'text' as const, text: mcpContentText(row.content, JSON.stringify(value)) }]
    }
  }
  return [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value ?? null) }]
}

/** Free-form object output — same wire shape as the former REST tools. */
const mcpOut = {
  schema: { type: 'object' as const, additionalProperties: true as const },
  render: renderMcpResult,
}

function defineRemoteTool(
  tool: NetxMcpToolDescriptor,
  timeoutMs: number,
): ReturnType<typeof defineTool> {
  const name = publicToolName(tool.name)
  return defineTool({
    name,
    description: tool.description || name,
    parameters: parametersFromInputSchema(tool.inputSchema) as never,
    output: mcpOut,
    timeoutMs,
    isConcurrencySafe: () => tool.readOnlyHint === true,
    async execute(args, exec) {
      const live = getNetxConnection()
      const apiUrl = live?.apiUrl ?? ''
      const token = live?.token ?? ''
      const lang = live?.lang ?? 'zh'
      const mcpUrl = mcpEndpointUrl(apiUrl)
      if (!mcpUrl) throw new Error('netx mcp: apiUrl empty')
      const result = await callMcpTool(
        {
          mcpUrl,
          token,
          lang,
          timeoutMs,
          signal: exec.signal,
        },
        tool.name,
        (typeof args === 'object' && args !== null ? args : {}) as Record<string, unknown>,
      )
      const text = mcpContentText(result.content, '')
      // Pass business failures through as ToolRuntime errors (model sees isError).
      if (result.isError === true) {
        throw new Error(text || `Tool "${tool.name}" failed`)
      }
      // Round-trip keeps DSH tool results lossless JSON-compatible.
      return JSON.parse(JSON.stringify({
        content: result.content,
        ...(result.structuredContent !== undefined
          ? { structuredContent: result.structuredContent }
          : {}),
        ...(text ? { text } : {}),
      })) as Record<string, never>
    },
  })
}

export interface RegisterNetxToolsOptions {
  /**
   * `preset` — groups with `inPreset` (Netx Ops preset scope).
   * `public` — groups with `public` only.
   * `host` — same as `public` (Host-global registry for other presets).
   */
  plane: 'preset' | 'public' | 'host'
  /** Optional intersect with settings-enabled groups. */
  only?: readonly NetxCapabilityGroupId[]
  /** When set, register exactly these groups (ignore plane flags). */
  forceGroups?: readonly NetxCapabilityGroupId[]
  source?: string
  presetId?: string
}

/**
 * Register Netx Ops tools for one exposure plane from the cached MCP catalog.
 * @returns disposer that unregisters every tool.
 */
export function registerNetxTools(
  ctx: Context,
  connection: NetxToolConnection,
  options: RegisterNetxToolsOptions,
): () => void {
  const id = getToolMountId(ctx, options.source ?? options.plane)
  const enabled = resolveEnabledTools(getMcpCatalogTools(), {
    toolsEnabled: connection.toolsEnabled,
    groups: connection.groups,
    disabledTools: connection.disabledTools,
    readOnlyOnly: connection.readOnlyOnly,
    plane: options.plane,
    forceGroups: options.forceGroups,
    only: options.only,
    presetId: options.presetId,
  })
  const groups = [...new Set(enabled.map(tool => tool.group).filter(Boolean))] as NetxCapabilityGroupId[]

  if (enabled.length === 0) {
    publishToolMountStatus({
      id,
      version: packageVersion(),
      plane: options.plane,
      groups,
      names: [],
      count: 0,
      at: new Date().toISOString(),
      source: options.source ?? options.plane,
    })
    return () => { removeToolMountStatus(id) }
  }

  const t = typeof connection.toolCallTimeoutMs === 'number'
    && Number.isFinite(connection.toolCallTimeoutMs)
    && connection.toolCallTimeoutMs > 0
    ? connection.toolCallTimeoutMs
    : 120_000

  const disposers: Array<() => void> = []
  const names: string[] = []
  try {
    for (const tool of enabled) {
      const definition = defineRemoteTool(tool, t)
      disposers.push(ctx.tools.register(definition))
      names.push(publicToolName(tool.name))
    }
  } catch (error) {
    for (const dispose of disposers.splice(0)) dispose()
    publishToolMountStatus({
      id,
      version: packageVersion(),
      plane: options.plane,
      groups,
      names: [],
      count: 0,
      at: new Date().toISOString(),
      error: String(error),
      source: options.source ?? options.plane,
    })
    throw error
  }

  publishToolMountStatus({
    id,
    version: packageVersion(),
    plane: options.plane,
    groups,
    names,
    count: names.length,
    at: new Date().toISOString(),
    source: options.source ?? options.plane,
  })

  return () => {
    for (const dispose of disposers) dispose()
    removeToolMountStatus(id)
  }
}
