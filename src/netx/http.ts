/**
 * Shared URL helpers for netx connection settings / alarm push.
 * Tool calls go through `/mcp` (see mcp-remote.ts); REST handlers were removed.
 */

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

/**
 * True for plain `http://` to a non-loopback host: the token and the skills
 * injected into the model's prompt would travel unencrypted.
 */
export function isInsecureRemoteApiUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return false
  }
  if (url.protocol !== 'http:') return false
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  return !(host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^127\./.test(host))
}
