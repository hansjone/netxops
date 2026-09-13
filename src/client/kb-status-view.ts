/**
 * Browser helpers for knowledge-base status via Host Connection RPC.
 */

import type { KbSnapshot, KbStatus } from '../netx/kb-manifest.ts'
import { unconfiguredKbSnapshot } from '../netx/kb-manifest.ts'
import type { AlarmPushRpcCall } from './alarm-push-status-view.ts'

/** Same channel as host `NETXOPS_RPC_CHANNEL`. */
export const NETXOPS_RPC_CHANNEL = '/netxops'

export const KB_STATUS_ENDPOINT = 'kb.status'
export const KB_RESOLVE_ENDPOINT = 'kb.resolve'

export type { KbSnapshot, KbStatus }

/**
 * Normalize a host KB snapshot for the card.
 */
export function asKbSnapshot(value: unknown): KbSnapshot {
  const empty = unconfiguredKbSnapshot()
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return empty
  const row = value as Record<string, unknown>
  const status = row.status === 'configured' || row.status === 'error' || row.status === 'unconfigured'
    ? row.status
    : 'unconfigured'
  const contentRaw = row.content
  const content = { ...empty.content }
  if (contentRaw !== null && typeof contentRaw === 'object' && !Array.isArray(contentRaw)) {
    for (const [key, flag] of Object.entries(contentRaw as Record<string, unknown>)) {
      content[key] = flag === true
    }
  }
  return {
    status,
    realRoot: typeof row.realRoot === 'string' ? row.realRoot : '',
    operatorName: typeof row.operatorName === 'string' ? row.operatorName : '',
    country: typeof row.country === 'string' ? row.country : '',
    version: typeof row.version === 'string' ? row.version : '',
    content,
    errorMessage: typeof row.errorMessage === 'string' ? row.errorMessage : '',
  }
}

/**
 * Fetch the published KB snapshot from the Host.
 */
export async function fetchKbStatus(
  call: AlarmPushRpcCall,
  signal?: AbortSignal,
): Promise<KbSnapshot> {
  const result = await call(NETXOPS_RPC_CHANNEL, KB_STATUS_ENDPOINT, {}, signal)
  if (result !== null && typeof result === 'object' && (result as { ok?: boolean }).ok === true) {
    return asKbSnapshot((result as { value?: unknown }).value)
  }
  return unconfiguredKbSnapshot()
}

/**
 * Preview resolve for a path that may not be saved yet.
 */
export async function resolveKbPath(
  call: AlarmPushRpcCall,
  path: string,
  signal?: AbortSignal,
): Promise<KbSnapshot> {
  // Prefer flat `{ path }` (netxops channel); also try `{ args: { path } }`.
  let result = await call(NETXOPS_RPC_CHANNEL, KB_RESOLVE_ENDPOINT, { path }, signal)
  if (!(result !== null && typeof result === 'object' && (result as { ok?: boolean }).ok === true)) {
    result = await call(NETXOPS_RPC_CHANNEL, KB_RESOLVE_ENDPOINT, { args: { path } }, signal)
  }
  if (result !== null && typeof result === 'object' && (result as { ok?: boolean }).ok === true) {
    return asKbSnapshot((result as { value?: unknown }).value)
  }
  return unconfiguredKbSnapshot()
}

/** Badge tone for the settings card. */
export function kbStatusTone(status: KbStatus): 'ok' | 'warn' | 'err' | 'neutral' {
  if (status === 'configured') return 'ok'
  if (status === 'error') return 'err'
  if (status === 'unconfigured') return 'warn'
  return 'neutral'
}
