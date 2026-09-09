/**
 * Shared bulk session-export constants and status types (safe for host + browser).
 */

/** Authenticated browser download path for the all-sessions archive. */
export const NETXOPS_SESSIONS_EXPORT_PATH = '/api/netxops.sessions.export'

/**
 * Stable export-status / download failure codes for client locale mapping.
 * Prefer these over free-form `reason` / Error.message in the Plugins card.
 */
export type SessionsExportReasonCode =
  | 'rpc_unavailable'
  | 'rpc_failed'
  | 'no_persistence'
  | 'no_raw_artifacts'
  | 'list_failed'
  | 'http_failed'
  | 'empty_body'

/** Preflight / RPC snapshot for the Plugins card. */
export interface SessionsExportStatus {
  readonly available: boolean
  readonly sessionCount: number
  readonly supportsRawArtifacts: boolean
  /** Stable code for UI i18n (preferred). */
  readonly reasonCode?: SessionsExportReasonCode
  /** Optional English diagnostic for logs / fallback when no locale key. */
  readonly reason?: string
}
