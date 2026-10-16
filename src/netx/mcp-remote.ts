/**
 * Stateless Streamable HTTP client for netx `/mcp`.
 *
 * Uses the runtime's standard `fetch` (injectable via `fetchImpl` for tests).
 * Request/response shapes follow MCP Streamable HTTP JSON-RPC. Prefer this thin
 * client over wiring `@modelcontextprotocol/sdk` / DSH `dsh-mcp-client` here:
 * those pull Cordis peers or would require a new package dependency.
 */

import type { NetxCapabilityGroupId } from './capability-groups.ts'
import { CAPABILITY_GROUP_IDS } from './capability-groups.ts'
import type { NetxMcpToolDescriptor } from './mcp-types.ts'
import type { CachedSkillFile } from './skills-cache.ts'

const PROTOCOL_VERSION = '2025-03-26'
const CLIENT_INFO = { name: 'dsh-netxops', version: '0.1.71' }
const SKILLS_URI_PREFIX = 'netx://skills/'

export interface McpRemoteOptions {
  /** Absolute MCP endpoint, e.g. `http://127.0.0.1:8890/mcp`. */
  mcpUrl: string
  /** Bearer token (may be empty — server returns 401). */
  token: string
  /** Optional Accept-Language / lang hint for bilingual descriptions. */
  lang?: string
  timeoutMs?: number
  signal?: AbortSignal
  /** Optional override for tests; defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch
}

export interface McpCallResult {
  content: unknown[]
  structuredContent?: unknown
  isError?: boolean
}

type JsonRpcSuccess = { jsonrpc: '2.0'; id: number | string; result: unknown }

export class McpRemoteError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'McpRemoteError'
    this.status = status
  }
}

/** Build `<apiUrl>/mcp` (apiUrl may already include a path prefix). */
export function mcpEndpointUrl(apiUrl: string): string {
  const trimmed = apiUrl.trim().replace(/\/$/, '')
  if (!trimmed) return ''
  return `${trimmed}/mcp`
}

function isGroupId(value: unknown): value is NetxCapabilityGroupId {
  return typeof value === 'string' && (CAPABILITY_GROUP_IDS as readonly string[]).includes(value)
}

function parseTool(raw: unknown): NetxMcpToolDescriptor | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  const name = typeof row.name === 'string' ? row.name.trim() : ''
  if (!name) return null
  const description = typeof row.description === 'string' ? row.description : ''
  const inputSchema = row.inputSchema && typeof row.inputSchema === 'object' && !Array.isArray(row.inputSchema)
    ? row.inputSchema as Record<string, unknown>
    : { type: 'object', properties: {} }
  const annotations = row.annotations && typeof row.annotations === 'object' && !Array.isArray(row.annotations)
    ? row.annotations as Record<string, unknown>
    : {}
  const readOnlyHint = annotations.readOnlyHint === true
  const meta = row._meta && typeof row._meta === 'object' && !Array.isArray(row._meta)
    ? row._meta as Record<string, unknown>
    : {}
  const netx = meta.netx && typeof meta.netx === 'object' && !Array.isArray(meta.netx)
    ? meta.netx as Record<string, unknown>
    : {}
  // Plugin mounts skills itself — never register getNetxSkill (group=meta).
  if (netx.group === 'meta') return null
  const group = isGroupId(netx.group) ? netx.group : undefined
  return { name, description, inputSchema, readOnlyHint, group }
}

function readMetaNetx(row: Record<string, unknown>): Record<string, unknown> {
  const meta = (row._meta ?? row.meta)
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {}
  const netx = (meta as Record<string, unknown>).netx
  if (!netx || typeof netx !== 'object' || Array.isArray(netx)) return {}
  return netx as Record<string, unknown>
}

function parseSkillResource(
  resource: unknown,
  text: string,
): CachedSkillFile | null {
  if (!resource || typeof resource !== 'object' || Array.isArray(resource)) return null
  const row = resource as Record<string, unknown>
  const uri = typeof row.uri === 'string' ? row.uri.trim() : ''
  const netx = readMetaNetx(row)
  const group = isGroupId(netx.group) ? netx.group : undefined
  const skill = typeof netx.skill === 'string' ? netx.skill.trim() : ''
  if (!group || !skill) return null

  let relPath = typeof row.name === 'string' ? row.name.trim().replace(/\\/g, '/') : ''
  if (!relPath && uri.startsWith(SKILLS_URI_PREFIX)) {
    const rest = uri.slice(SKILLS_URI_PREFIX.length)
    const parts = rest.split('/')
    // <groupDir>/<skill>/<rel...>
    if (parts.length >= 3) relPath = parts.slice(2).join('/')
  }
  if (!relPath || relPath.includes('..')) return null
  const unavailableTools = Array.isArray(netx.unavailableTools)
    ? netx.unavailableTools.filter((n): n is string => typeof n === 'string' && n.length > 0)
    : []
  return {
    group,
    skill,
    relPath,
    text,
    ...(netx.entry === true && unavailableTools.length > 0 ? { unavailableTools } : {}),
  }
}

function resourcesCapability(capabilities: unknown): boolean {
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) return false
  return 'resources' in (capabilities as Record<string, unknown>)
}

/**
 * Parse an MCP HTTP body: application/json, or SSE `data:` frames
 * (Streamable HTTP when not using json_response).
 */
export function parseMcpResponseBody(raw: string): unknown {
  const text = raw.replace(/^\uFEFF/, '').trim()
  if (!text) throw new McpRemoteError('empty /mcp response body')

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      return JSON.parse(text)
    } catch (error) {
      throw new McpRemoteError(
        `mcp JSON parse failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  if (text.includes('data:')) {
    const dataLines: string[] = []
    for (const line of text.split(/\r?\n/)) {
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
    }
    for (let i = dataLines.length - 1; i >= 0; i -= 1) {
      try { return JSON.parse(dataLines[i]!) } catch { /* continue */ }
    }
  }

  throw new McpRemoteError('mcp response was not JSON')
}

function asRpcResult(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new McpRemoteError('invalid JSON-RPC envelope from /mcp')
  }
  const row = payload as Record<string, unknown>
  if (row.error && typeof row.error === 'object' && !Array.isArray(row.error)) {
    const err = row.error as { code?: unknown; message?: unknown }
    const message = typeof err.message === 'string' ? err.message : 'JSON-RPC error'
    throw new McpRemoteError(message)
  }
  if (!('result' in row)) {
    throw new McpRemoteError('JSON-RPC response missing result')
  }
  return (payload as JsonRpcSuccess).result
}

let nextId = 1

async function postRpc(
  options: McpRemoteOptions,
  method: string,
  params?: Record<string, unknown>,
  notification = false,
): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  }
  const token = options.token.trim()
  if (token) headers.Authorization = `Bearer ${token}`
  const lang = options.lang?.trim()
  if (lang) {
    headers['Accept-Language'] = lang.toLowerCase().startsWith('en') ? 'en' : 'zh'
  }

  const body = notification
    ? { jsonrpc: '2.0', method, ...(params ? { params } : {}) }
    : { jsonrpc: '2.0', id: nextId++, method, ...(params ? { params } : {}) }
  const bodyText = JSON.stringify(body)

  const timeoutMs = typeof options.timeoutMs === 'number' && options.timeoutMs > 0
    ? options.timeoutMs
    : 60_000

  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    throw new McpRemoteError('fetch is not available')
  }

  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), timeoutMs)
  const onOuterAbort = (): void => { abort.abort() }
  options.signal?.addEventListener('abort', onOuterAbort, { once: true })
  let response: Response
  try {
    response = await fetchImpl(options.mcpUrl, {
      method: 'POST',
      headers,
      body: bodyText,
      signal: abort.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new McpRemoteError('mcp http timeout')
    }
    throw error
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onOuterAbort)
  }

  const responseText = await response.text()

  if (response.status === 401 || response.status === 403) {
    throw new McpRemoteError(`HTTP ${response.status} unauthorized`, response.status)
  }
  if (response.status < 200 || response.status >= 300) {
    throw new McpRemoteError(
      `HTTP ${response.status}${responseText ? `: ${responseText.slice(0, 200)}` : ''}`,
      response.status,
    )
  }
  if (notification) {
    return undefined
  }
  return asRpcResult(parseMcpResponseBody(responseText))
}

export interface McpCatalogFetchResult {
  tools: NetxMcpToolDescriptor[]
  /**
   * Set when resources were listed and read successfully (may be empty).
   * Omitted when the server has no resources capability or the pull failed —
   * callers should treat that as “no skills” while still keeping tools.
   */
  skills?: CachedSkillFile[]
  skillsError?: string
}

/**
 * initialize → notifications/initialized → tools/list
 * (+ resources/list + resources/read when the server advertises resources).
 */
export async function fetchMcpCatalog(options: McpRemoteOptions): Promise<McpCatalogFetchResult> {
  if (!options.mcpUrl) throw new McpRemoteError('mcp url is empty')
  const init = await postRpc(options, 'initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: CLIENT_INFO,
  }) as { capabilities?: unknown }
  await postRpc(options, 'notifications/initialized', {}, true)
  const toolsResult = await postRpc(options, 'tools/list', {}) as { tools?: unknown }
  const toolsRaw = Array.isArray(toolsResult?.tools) ? toolsResult.tools : []
  const tools: NetxMcpToolDescriptor[] = []
  for (const item of toolsRaw) {
    const parsed = parseTool(item)
    if (parsed) tools.push(parsed)
  }

  if (!resourcesCapability(init?.capabilities)) {
    // No resources capability → the server publishes no skills (not an error).
    return { tools, skills: [] }
  }

  try {
    const listed = await postRpc(options, 'resources/list', {}) as { resources?: unknown }
    const resources = Array.isArray(listed?.resources) ? listed.resources : []
    const skills: CachedSkillFile[] = []
    for (const resource of resources) {
      if (!resource || typeof resource !== 'object' || Array.isArray(resource)) continue
      const uri = typeof (resource as { uri?: unknown }).uri === 'string'
        ? (resource as { uri: string }).uri.trim()
        : ''
      if (!uri.startsWith(SKILLS_URI_PREFIX)) continue
      const read = await postRpc(options, 'resources/read', { uri }) as { contents?: unknown }
      const contents = Array.isArray(read?.contents) ? read.contents : []
      let text = ''
      for (const block of contents) {
        if (!block || typeof block !== 'object' || Array.isArray(block)) continue
        const row = block as { text?: unknown }
        if (typeof row.text === 'string') {
          text = row.text
          break
        }
      }
      const parsed = parseSkillResource(resource, text)
      if (parsed) skills.push(parsed)
    }
    return { tools, skills }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { tools, skillsError: message }
  }
}

/**
 * initialize → notifications/initialized → tools/list.
 */
export async function listMcpTools(options: McpRemoteOptions): Promise<NetxMcpToolDescriptor[]> {
  const { tools } = await fetchMcpCatalog(options)
  return tools
}

/**
 * Forward tools/call. Stateless: initialize once per call sequence so servers
 * that reject orphaned calls still work.
 */
export async function callMcpTool(
  options: McpRemoteOptions,
  name: string,
  args: Record<string, unknown>,
): Promise<McpCallResult> {
  if (!options.mcpUrl) throw new McpRemoteError('mcp url is empty')
  await postRpc(options, 'initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: CLIENT_INFO,
  })
  await postRpc(options, 'notifications/initialized', {}, true)
  const result = await postRpc(options, 'tools/call', {
    name,
    arguments: args,
  }) as Record<string, unknown>
  const content = Array.isArray(result.content) ? result.content : []
  return {
    content,
    ...(result.structuredContent !== undefined ? { structuredContent: result.structuredContent } : {}),
    ...(result.isError === true ? { isError: true } : {}),
  }
}

/** Extract plain text from MCP content blocks for error / render paths. */
export function mcpContentText(content: unknown[], fallback = ''): string {
  const parts: string[] = []
  for (const block of content) {
    if (!block || typeof block !== 'object' || Array.isArray(block)) continue
    const row = block as { type?: unknown; text?: unknown }
    if (row.type === 'text' && typeof row.text === 'string') parts.push(row.text)
  }
  return parts.join('\n') || fallback
}
