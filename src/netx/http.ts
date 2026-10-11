/**
 * Minimal netx REST client (Bearer + lang), aligned with netx-mcp http_client.
 */

export interface NetxConnection {
  apiUrl: string
  lang: string
  timeoutMs: number
  /** Read the latest bearer on each request (do not freeze at client creation). */
  getToken: () => string
  /** Read the latest apiUrl on each request (settings may heal after first mount). */
  getApiUrl?: () => string
}

export type NetxJson = Record<string, unknown>

export type NormalizeApiUrlResult =
  | { ok: true, url: string }
  | { ok: false, error: 'empty' | 'invalid_url' | 'unsupported_scheme' | 'credentials_in_url' }

/**
 * Accept only bare http(s) API roots — no credentials-in-URL, no file/data/etc.
 * Trailing slash is stripped; path prefixes (e.g. `/netx`) are kept.
 */
export function normalizeApiUrl(raw: string): NormalizeApiUrlResult {
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  if (!trimmed) return { ok: false, error: 'empty' }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, error: 'invalid_url' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'unsupported_scheme' }
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'credentials_in_url' }
  }
  const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '')
  const search = parsed.search && parsed.search !== '?' ? parsed.search : ''
  return { ok: true, url: `${parsed.origin}${path}${search}` }
}

const PROTOCOL_KEY_ZH_TO_EN: Record<string, string> = {
  其他: 'Other',
  时钟: 'Clock',
  'OTN/光': 'OTN/Optical',
  电源: 'Power',
}

function asLang(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Localize a few protocol bucket keys when lang starts with en (match netx-mcp). */
function localizePayload(lang: string, data: NetxJson): NetxJson {
  if (!asLang(lang).trim().toLowerCase().startsWith('en')) return data
  const proto = data.protocol_summary
  if (!Array.isArray(proto)) return data
  for (const row of proto) {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) continue
    const rec = row as NetxJson
    const key = typeof rec.key === 'string' ? rec.key : ''
    const mapped = PROTOCOL_KEY_ZH_TO_EN[key]
    if (mapped !== undefined) rec.key = mapped
  }
  return data
}

function encodeQuery(params: Record<string, string | number | boolean>): string {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    sp.set(key, String(value))
  }
  const q = sp.toString()
  return q.length > 0 ? `?${q}` : ''
}

/**
 * Build a client bound to apiUrl / lang / timeout; Bearer + apiUrl are resolved per request.
 * @param connection - apiUrl / lang / timeout / getToken / optional getApiUrl.
 * @returns get/post helpers that return `{ ok, data }` or `{ ok: false, error }`.
 */
export function createNetxClient(connection: NetxConnection) {
  const langParams = (): Record<string, string> => {
    const lang = asLang(connection.lang).trim().toLowerCase()
    if (lang.startsWith('en')) return { lang: 'en' }
    return {}
  }

  async function request(
    method: string,
    path: string,
    options: {
      params?: Record<string, string | number | boolean>
      body?: NetxJson
      timeoutMs?: number
      signal?: AbortSignal
    } = {},
  ): Promise<NetxJson> {
    const rawUrl = typeof connection.getApiUrl === 'function'
      ? connection.getApiUrl()
      : connection.apiUrl
    const normalized = normalizeApiUrl(typeof rawUrl === 'string' ? rawUrl : '')
    const base = normalized.ok ? normalized.url : ''
    if (!normalized.ok || !base) {
      return {
        ok: false,
        error: 'netx_api_url_invalid',
        detail: `apiUrl must be http(s) without embedded credentials (${normalized.ok ? 'empty' : normalized.error}).`,
      }
    }
    const rawToken = connection.getToken()
    const token = typeof rawToken === 'string' ? rawToken.trim() : ''
    if (token.length === 0) {
      return {
        ok: false,
        error: 'netx_token_missing',
        detail: 'Set credential NETX_API_TOKEN (Plugins → Netx Ops or scripts/set-netx-token).',
      }
    }

    const merged: Record<string, string | number | boolean> = { ...langParams(), ...options.params }
    const url = `${base}${path}${encodeQuery(merged)}`
    const timeoutMs = options.timeoutMs ?? connection.timeoutMs
    const controller = new AbortController()
    const timer = setTimeout(() => { controller.abort() }, timeoutMs)
    const onOuterAbort = () => { controller.abort() }
    options.signal?.addEventListener('abort', onOuterAbort, { once: true })
    try {
      const headers: Record<string, string> = {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
      }
      if (options.body !== undefined) headers['content-type'] = 'application/json'
      const init: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      }
      if (options.body !== undefined) init.body = JSON.stringify(options.body)
      const resp = await fetch(url, init)
      const text = await resp.text()
      if (!resp.ok) {
        return { ok: false, error: `netx_http_${resp.status}`, detail: text.slice(0, 800) }
      }
      const data = text.length > 0 ? JSON.parse(text) as unknown : {}
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        return { ok: true, data: localizePayload(connection.lang, data as NetxJson) }
      }
      return { ok: true, data: { raw: data } }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      return { ok: false, error: 'netx_request_failed', detail: detail.slice(0, 800) }
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onOuterAbort)
    }
  }

  return {
    get(path: string, params?: Record<string, string | number | boolean>, signal?: AbortSignal, timeoutMs?: number) {
      return request('GET', path, { params, signal, timeoutMs })
    },
    post(path: string, body: NetxJson, signal?: AbortSignal, timeoutMs?: number) {
      return request('POST', path, { body, signal, timeoutMs })
    },
    patch(path: string, body: NetxJson, signal?: AbortSignal, timeoutMs?: number) {
      return request('PATCH', path, { body, signal, timeoutMs })
    },
  }
}

export type NetxClient = ReturnType<typeof createNetxClient>

/** Path-segment encode for NE ids (match urllib.parse.quote(..., safe='')). */
export function quoteNeId(neId: string): string {
  return encodeURIComponent(neId.trim())
}
