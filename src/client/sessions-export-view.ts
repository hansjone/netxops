/**
 * Plugins-card helpers for bulk session export status + browser ZIP download.
 */

import {
  NETXOPS_RPC_CHANNEL,
  type AlarmPushRpcCall,
} from './alarm-push-status-view.ts'
import {
  NETXOPS_SESSIONS_EXPORT_PATH,
  type SessionsExportReasonCode,
  type SessionsExportStatus,
} from '../session-export-shared.ts'
import type { NetxopsLocaleKey } from './locales.ts'

export type { SessionsExportStatus, SessionsExportReasonCode }
export { NETXOPS_SESSIONS_EXPORT_PATH }

export const SESSIONS_EXPORT_STATUS_ENDPOINT = 'sessions.export.status'

const EMPTY_STATUS: SessionsExportStatus = {
  available: false,
  sessionCount: 0,
  supportsRawArtifacts: false,
  reasonCode: 'rpc_unavailable',
  reason: 'RPC unavailable',
}

const REASON_CODES = new Set<SessionsExportReasonCode>([
  'rpc_unavailable',
  'rpc_failed',
  'no_persistence',
  'no_raw_artifacts',
  'list_failed',
  'http_failed',
  'empty_body',
])

function asReasonCode(value: unknown): SessionsExportReasonCode | undefined {
  return typeof value === 'string' && REASON_CODES.has(value as SessionsExportReasonCode)
    ? value as SessionsExportReasonCode
    : undefined
}

/** Map a status reasonCode to a client locale key. */
export function sessionsExportReasonLocaleKey(
  code: SessionsExportReasonCode | undefined,
): NetxopsLocaleKey {
  switch (code) {
    case 'no_persistence': return 'sessionsExportNoPersistence'
    case 'no_raw_artifacts': return 'sessionsExportNoRawArtifacts'
    case 'list_failed': return 'sessionsExportListFailed'
    case 'rpc_unavailable': return 'sessionsExportRpcUnavailable'
    case 'rpc_failed': return 'sessionsExportRpcFailed'
    case 'http_failed': return 'sessionsExportHttpFailed'
    case 'empty_body': return 'sessionsExportEmpty'
    default: return 'sessionsExportUnavailable'
  }
}

/**
 * Normalize a host export-status snapshot for the card.
 * @param value - RPC value or unknown.
 */
export function asSessionsExportStatus(value: unknown): SessionsExportStatus {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ...EMPTY_STATUS }
  }
  const row = value as Record<string, unknown>
  return {
    available: row.available === true,
    sessionCount: typeof row.sessionCount === 'number' ? row.sessionCount : 0,
    supportsRawArtifacts: row.supportsRawArtifacts === true,
    reasonCode: asReasonCode(row.reasonCode),
    reason: typeof row.reason === 'string' ? row.reason : undefined,
  }
}

/**
 * Read bulk-export readiness from Host RPC.
 * @param call - `connection.rpc.call`.
 * @param signal - optional abort.
 */
export async function fetchSessionsExportStatus(
  call: AlarmPushRpcCall,
  signal?: AbortSignal,
): Promise<SessionsExportStatus> {
  const result = await call(NETXOPS_RPC_CHANNEL, SESSIONS_EXPORT_STATUS_ENDPOINT, {}, signal)
  if (result !== null && typeof result === 'object' && (result as { ok?: boolean }).ok === true) {
    return asSessionsExportStatus((result as { value?: unknown }).value)
  }
  if (result !== null && typeof result === 'object' && (result as { ok?: boolean }).ok === false) {
    return {
      ...EMPTY_STATUS,
      reasonCode: 'rpc_failed',
      reason: String((result as { error?: { message?: string } }).error?.message ?? 'rpc failed'),
    }
  }
  return asSessionsExportStatus(result)
}

/** Resolve the browser Host base (null-origin fallback matches DSH download helpers). */
function hostBase(): string {
  const origin = (globalThis as { location?: { origin?: string } }).location?.origin
  return origin !== undefined && origin !== 'null' ? origin : 'http://dsh.internal'
}

/**
 * Save a Blob through the browser download manager (works for cloud Hosts:
 * the ZIP lands on the operator machine, not on the remote `$DSH_HOME`).
 * @param blob - ZIP bytes already fetched with credentials.
 * @param filename - suggested download filename.
 */
export function saveBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = filename
    anchor.rel = 'noopener'
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    // Keep the blob URL alive briefly so the download manager can start reading.
    globalThis.setTimeout(() => {
      URL.revokeObjectURL(objectUrl)
    }, 60_000)
  }
}

/** Browser download failure with a stable code for UI i18n. */
export class SessionsExportDownloadError extends Error {
  readonly code: Extract<SessionsExportReasonCode, 'http_failed' | 'empty_body'>
  readonly status?: number
  readonly detail: string

  constructor(
    code: Extract<SessionsExportReasonCode, 'http_failed' | 'empty_body'>,
    message: string,
    extra: { status?: number, detail?: string } = {},
  ) {
    super(message)
    this.name = 'SessionsExportDownloadError'
    this.code = code
    this.status = extra.status
    this.detail = extra.detail ?? ''
  }
}

/**
 * Fetch the bulk sessions ZIP and hand it to the browser download manager.
 * Uses a credentialed GET + blob URL (not a bare `<a href=/api/...>` click after
 * await), so cloud deployments and Chromium download UX both work.
 * @param fetcher - browser fetch (authenticated same-origin).
 * @param save - download trigger for the received blob.
 */
export async function downloadAllSessionsExport(
  fetcher: (input: string | URL, init?: RequestInit) => Promise<Response> = fetch,
  save: (blob: Blob, filename: string) => void = saveBlobDownload,
): Promise<{ filename: string; sessionCount: number; bytes: number }> {
  const url = new URL(NETXOPS_SESSIONS_EXPORT_PATH, hostBase())
  const response = await fetcher(url, {
    method: 'GET',
    credentials: 'include',
  })
  if (!response.ok) {
    const fromHeader = response.headers.get('x-netxops-export-error') ?? ''
    const detail = fromHeader || (await response.text().catch(() => ''))
    throw new SessionsExportDownloadError(
      'http_failed',
      `Export failed: HTTP ${response.status}${detail === '' ? '' : ` ${detail}`}`,
      { status: response.status, detail },
    )
  }
  const disposition = response.headers.get('content-disposition') ?? ''
  const matched = /filename="([^"]+)"/i.exec(disposition)
  const filename = matched?.[1] && matched[1].length > 0
    ? matched[1]
    : 'dsh-sessions-export.zip'
  const countHeader = response.headers.get('x-netxops-session-count')
  const sessionCount = countHeader !== null && countHeader !== ''
    ? Number.parseInt(countHeader, 10)
    : 0
  const blob = await response.blob()
  if (blob.size <= 0) {
    throw new SessionsExportDownloadError('empty_body', 'Export failed: empty ZIP body')
  }
  save(blob, filename)
  return {
    filename,
    sessionCount: Number.isFinite(sessionCount) ? sessionCount : 0,
    bytes: blob.size,
  }
}
