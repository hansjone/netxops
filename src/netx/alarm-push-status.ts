/**
 * Process-local alarm-push connection status (host → browser via RPC).
 */

export type AlarmPushPhase =
  | 'disabled'
  | 'idle'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'auth_failed'
  | 'error'

export interface AlarmPushStatus {
  phase: AlarmPushPhase
  enabled: boolean
  wsUrl: string
  detail: string
  updatedAt: number
  lastConnectedAt: number | null
  lastError: string | null
}

type Listener = () => void

interface Store {
  status: AlarmPushStatus
  listeners: Set<Listener>
}

const STORE_KEY = Symbol.for('dsh-netxops.alarm-push-status')

function emptyStatus(partial: Partial<AlarmPushStatus> = {}): AlarmPushStatus {
  return {
    phase: 'disabled',
    enabled: false,
    wsUrl: '',
    detail: '',
    updatedAt: Date.now(),
    lastConnectedAt: null,
    lastError: null,
    ...partial,
  }
}

function store(): Store {
  const root = globalThis as typeof globalThis & { [STORE_KEY]?: Store }
  let current = root[STORE_KEY]
  if (current === undefined) {
    current = { status: emptyStatus(), listeners: new Set() }
    root[STORE_KEY] = current
  }
  return current
}

/** @returns the latest alarm-push status snapshot. */
export function getAlarmPushStatus(): AlarmPushStatus {
  return { ...store().status }
}

/**
 * Replace the published status and notify listeners.
 * @param next - full or partial status fields.
 */
export function publishAlarmPushStatus(next: Partial<AlarmPushStatus> & Pick<AlarmPushStatus, 'phase'>): void {
  const state = store()
  state.status = {
    ...state.status,
    ...next,
    updatedAt: Date.now(),
  }
  for (const listener of state.listeners) listener()
}

/**
 * Subscribe to status publishes.
 * @param listener - called after each publish.
 */
export function watchAlarmPushStatus(listener: Listener): () => void {
  const state = store()
  state.listeners.add(listener)
  return () => { state.listeners.delete(listener) }
}

/** Reset to disabled (plugin dispose / toggle off). */
export function resetAlarmPushStatus(): void {
  publishAlarmPushStatus(emptyStatus({ phase: 'disabled', enabled: false }))
}
