/**
 * Browser-side alarm-push status labels + Connection RPC poll helper.
 */

import type { AlarmPushPhase, AlarmPushStatus } from '../netx/alarm-push-status.ts'

/** Same channel as host `NETXOPS_RPC_CHANNEL`. */
export const NETXOPS_RPC_CHANNEL = '/netxops'

export const ALARM_PUSH_STATUS_ENDPOINT = 'alarm-push.status'

export type { AlarmPushPhase, AlarmPushStatus }

export type AlarmPushRpcCall = (
  channel: string,
  endpoint: string,
  payload?: unknown,
  signal?: AbortSignal,
) => Promise<unknown>

const EMPTY: AlarmPushStatus = {
  phase: 'disabled',
  enabled: false,
  wsUrl: '',
  detail: '',
  updatedAt: 0,
  lastConnectedAt: null,
  lastError: null,
}

/**
 * Normalize a host status snapshot for the card.
 * @param value - RPC value or unknown.
 */
export function asAlarmPushStatus(value: unknown): AlarmPushStatus {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return { ...EMPTY }
  const row = value as Record<string, unknown>
  const phase = typeof row.phase === 'string' ? row.phase as AlarmPushPhase : 'disabled'
  return {
    phase,
    enabled: row.enabled === true,
    wsUrl: typeof row.wsUrl === 'string' ? row.wsUrl : '',
    detail: typeof row.detail === 'string' ? row.detail : '',
    updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
    lastConnectedAt: typeof row.lastConnectedAt === 'number' ? row.lastConnectedAt : null,
    lastError: typeof row.lastError === 'string' ? row.lastError : null,
  }
}

/**
 * Fetch the latest host-side alarm-push status.
 * @param call - `ctx.connection.rpc.call`.
 * @param signal - optional abort.
 */
export async function fetchAlarmPushStatus(
  call: AlarmPushRpcCall,
  signal?: AbortSignal,
): Promise<AlarmPushStatus> {
  const result = await call(NETXOPS_RPC_CHANNEL, ALARM_PUSH_STATUS_ENDPOINT, {}, signal)
  if (result !== null && typeof result === 'object' && (result as { ok?: boolean }).ok === true) {
    return asAlarmPushStatus((result as { value?: unknown }).value)
  }
  if (result !== null && typeof result === 'object' && (result as { ok?: boolean }).ok === false) {
    return {
      ...EMPTY,
      phase: 'error',
      enabled: true,
      detail: 'rpc_error',
      lastError: String((result as { error?: { message?: string } }).error?.message ?? 'rpc failed'),
    }
  }
  return asAlarmPushStatus(result)
}

/** CSS modifier for a phase badge. */
export function alarmPushTone(phase: AlarmPushPhase): 'ok' | 'warn' | 'err' | 'mute' {
  switch (phase) {
    case 'connected':
      return 'ok'
    case 'connecting':
    case 'authenticating':
    case 'reconnecting':
      return 'warn'
    case 'auth_failed':
    case 'error':
      return 'err'
    default:
      return 'mute'
  }
}
