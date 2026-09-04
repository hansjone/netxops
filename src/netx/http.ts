/**
 * Minimal netx REST client (Bearer + lang), aligned with netx-mcp http_client.
 */

export interface NetxConnection {
  apiUrl: string
  token: string
  lang: string
  timeoutMs: number
}

export type NetxJson = Record<string, unknown>

const PROTOCOL_KEY_ZH_TO_EN: Record<string, string> = {
  其他: 'Other',
  时钟: 'Clock',
  'OTN/光': 'OTN/Optical',
  电源: 'Power',
}

/** Localize a few protocol bucket keys when lang starts with en (match netx-mcp). */
function localizePayload(lang: string, data: NetxJson): NetxJson {
  if (!lang.trim().toLowerCase().startsWith('en')) return data
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
 * Build a client bound to the current settings/credentials snapshot.
 * @param connection - apiUrl / token / lang / default timeout.
 * @returns get/post helpers that return `{ ok, data }` or `{ ok: false, error }`.
 */
export function createNetxClient(connection: NetxConnection) {
  const base = connection.apiUrl.replace(/\/$/, '')
  const headers: Record<string, string> = {
    accept: 'application/json',
  }
  if (connection.token.trim().length > 0) {
    headers.authorization = `Bearer ${connection.token.trim()}`
  }

  const langParams = (): Record<string, string> => {
    const lang = connection.lang.trim().toLowerCase()
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
    const merged: Record<string, string | number | boolean> = { ...langParams(), ...options.params }
    const url = `${base}${path}${encodeQuery(merged)}`
    const timeoutMs = options.timeoutMs ?? connection.timeoutMs
    const controller = new AbortController()
    const timer = setTimeout(() => { controller.abort() }, timeoutMs)
    const onOuterAbort = () => { controller.abort() }
    options.signal?.addEventListener('abort', onOuterAbort, { once: true })
    try {
      const init: RequestInit = {
        method,
        headers: options.body === undefined
          ? headers
          : { ...headers, 'content-type': 'application/json' },
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
  }
}

export type NetxClient = ReturnType<typeof createNetxClient>

/** Path-segment encode for NE ids (match urllib.parse.quote(..., safe='')). */
export function quoteNeId(neId: string): string {
  return encodeURIComponent(neId.trim())
}
