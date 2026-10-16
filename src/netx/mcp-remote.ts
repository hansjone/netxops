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

const PROTOCOL_VERSION = '2025-03-26'
const CLIENT_INFO = { name: 'dsh-netxops', version: '0.1.71' }

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
  const group = isGroupId(netx.group) ? netx.group : undefined
  return { name, description, inputSchema, readOnlyHint, group }
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

/**
 * initialize → notifications/initialized → tools/list.
 */
export async function listMcpTools(options: McpRemoteOptions): Promise<NetxMcpToolDescriptor[]> {
  if (!options.mcpUrl) throw new McpRemoteError('mcp url is empty')
  await postRpc(options, 'initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: CLIENT_INFO,
  })
  await postRpc(options, 'notifications/initialized', {}, true)
  const result = await postRpc(options, 'tools/list', {}) as { tools?: unknown }
  const tools = Array.isArray(result?.tools) ? result.tools : []
  const out: NetxMcpToolDescriptor[] = []
  for (const item of tools) {
    const parsed = parseTool(item)
    if (parsed) out.push(parsed)
  }
  return out
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
