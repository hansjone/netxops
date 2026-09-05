/**
 * Convert a netx REST apiUrl into the DSH alarm-subscribe WebSocket URL.
 * @param apiUrl - e.g. http://192.168.1.10:8890
 */
export function alarmSubscribeUrl(apiUrl: string): string {
  const trimmed = apiUrl.trim().replace(/\/$/, '')
  if (!trimmed) return ''
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return ''
  }
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/v1/integrations/dsh-alarm/ws'
  url.search = ''
  url.hash = ''
  return url.toString()
}

export interface KeyAlarmPayload {
  action?: string
  alarm_key?: string
  notification_id?: string
  rule_label?: string
  rule_key?: string
  native_probable_cause?: string
  perceived_severity?: string
  time_created?: string
  object_name?: string
  ne_id?: string
  ne?: Record<string, string>
  [key: string]: unknown
}

/** Human-readable prompt for a sticky Netx Ops DSH session. */
export function formatAlarmPrompt(payload: KeyAlarmPayload, lang = 'zh'): string {
  const action = String(payload.action ?? '').trim().toLowerCase()
  const actionZh: Record<string, string> = {
    inserted: '告警产生',
    updated: '告警更新',
    deleted: '告警清除',
  }
  const actionEn: Record<string, string> = {
    inserted: 'Alarm Raised',
    updated: 'Alarm Updated',
    deleted: 'Alarm Cleared',
  }
  const ne = payload.ne && typeof payload.ne === 'object' ? payload.ne : {}
  const host = String(ne.host_name ?? '').trim()
  const ip = String(ne.ip_address ?? '').trim()
  const neName = String(ne.ne_name ?? ne.user_label ?? '').trim()
  let device = host || neName || String(payload.ne_id ?? '').trim() || '-'
  if (ip) device = device === '-' ? ip : `${device} (${ip})`

  const label = String(payload.rule_label ?? payload.native_probable_cause ?? '关键告警').trim()
  if (lang.startsWith('en')) {
    return [
      `[UME ${actionEn[action] ?? (action || 'Alarm')}] ${label}`,
      `Device: ${device}`,
      `Object: ${String(payload.object_name ?? '-').trim()}`,
      `Severity: ${String(payload.perceived_severity ?? '-').trim()}`,
      `Cause: ${String(payload.native_probable_cause ?? '-').trim()}`,
      `Time: ${String(payload.time_created ?? '-').trim()}`,
      `notificationId: ${String(payload.notification_id ?? '-').trim()}`,
      `alarm_key: ${String(payload.alarm_key ?? '-').trim()}`,
      '',
      'Please analyze this key alarm and suggest next ops steps.',
    ].join('\n')
  }
  return [
    `[UME ${actionZh[action] ?? (action || '告警')}] ${label}`,
    `设备: ${device}`,
    `对象: ${String(payload.object_name ?? '-').trim()}`,
    `级别: ${String(payload.perceived_severity ?? '-').trim()}`,
    `原因: ${String(payload.native_probable_cause ?? '-').trim()}`,
    `时间: ${String(payload.time_created ?? '-').trim()}`,
    `notificationId: ${String(payload.notification_id ?? '-').trim()}`,
    `alarm_key: ${String(payload.alarm_key ?? '-').trim()}`,
    '',
    '请分析这条关键告警并给出下一步运维建议。',
  ].join('\n')
}

export type AlarmHandler = (payload: KeyAlarmPayload) => void | Promise<void>

export interface AlarmPushClientOptions {
  apiUrl: string
  token: string
  logger?: {
    info?: (...args: unknown[]) => void
    warn?: (...args: unknown[]) => void
    error?: (...args: unknown[]) => void
  }
  onAlarm: AlarmHandler
  /** Reconnect delay base in ms (default 2000). */
  reconnectMs?: number
  /** WebSocket constructor override (tests). */
  WebSocketImpl?: typeof WebSocket
}

/**
 * Dial out to netx's fixed-IP alarm hub and forward `netx.alarm` events.
 * @returns disposer that closes the socket and cancels reconnect.
 */
export function startAlarmPushClient(options: AlarmPushClientOptions): () => void {
  const log = options.logger ?? console
  const wsUrl = alarmSubscribeUrl(options.apiUrl)
  const token = options.token.trim()
  if (!wsUrl || !token) {
    log.warn?.('netxops alarm-push: missing apiUrl or token — not connecting')
    return () => {}
  }

  const WS = options.WebSocketImpl ?? globalThis.WebSocket
  if (typeof WS !== 'function') {
    log.error?.('netxops alarm-push: WebSocket is unavailable in this runtime')
    return () => {}
  }

  let closed = false
  let socket: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let attempt = 0
  const baseDelay = Math.max(500, options.reconnectMs ?? 2_000)

  const clearReconnect = (): void => {
    if (reconnectTimer !== undefined) {
      clearTimeout(reconnectTimer)
      reconnectTimer = undefined
    }
  }

  const scheduleReconnect = (): void => {
    if (closed) return
    clearReconnect()
    const delay = Math.min(60_000, baseDelay * (2 ** Math.min(attempt, 5)))
    attempt += 1
    reconnectTimer = setTimeout(() => { connect() }, delay)
  }

  const connect = (): void => {
    if (closed) return
    clearReconnect()
    try {
      socket = new WS(wsUrl)
    } catch (error) {
      log.warn?.('netxops alarm-push: connect failed:', error)
      scheduleReconnect()
      return
    }

    socket.addEventListener('open', () => {
      attempt = 0
      socket?.send(JSON.stringify({ type: 'auth', token }))
    })

    socket.addEventListener('message', (event) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(String(event.data)) as Record<string, unknown>
      } catch {
        return
      }
      const type = String(msg.type ?? '').toLowerCase()
      if (type === 'auth-ok') {
        log.info?.('netxops alarm-push: subscribed to %s', wsUrl)
        return
      }
      if (type === 'auth-fail') {
        log.error?.('netxops alarm-push: auth failed (%s)', msg.error)
        socket?.close()
        return
      }
      if (type === 'pong') return
      if (type === 'event' && String(msg.event ?? '') === 'netx.alarm') {
        const payload = msg.payload && typeof msg.payload === 'object'
          ? msg.payload as KeyAlarmPayload
          : {}
        void Promise.resolve(options.onAlarm(payload)).catch((error) => {
          log.warn?.('netxops alarm-push: handler failed:', error)
        })
      }
    })

    socket.addEventListener('close', () => {
      socket = null
      if (!closed) scheduleReconnect()
    })

    socket.addEventListener('error', () => {
      // close handler schedules reconnect
    })
  }

  // Keepalive ping while connected.
  const pingTimer = setInterval(() => {
    if (socket && socket.readyState === WS.OPEN) {
      try {
        socket.send(JSON.stringify({ type: 'ping', ts: new Date().toISOString() }))
      } catch {
        // ignore
      }
    }
  }, 25_000)

  connect()

  return () => {
    closed = true
    clearReconnect()
    clearInterval(pingTimer)
    try {
      socket?.close()
    } catch {
      // ignore
    }
    socket = null
  }
}
