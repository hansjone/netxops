/**
 * Shared bulk session-export constants and status types (safe for host + browser).
 */

/** Authenticated browser download path for the all-sessions archive. */
export const NETXOPS_SESSIONS_EXPORT_PATH = '/api/netxops.sessions.export'

/** Preflight / RPC snapshot for the Plugins card. */
export interface SessionsExportStatus {
  readonly available: boolean
  readonly sessionCount: number
  readonly supportsRawArtifacts: boolean
  readonly reason?: string
}
