/**
 * Browser helper: load saved IM delivery targets via Netx Ops Connection RPC.
 */

import {
  NETXOPS_RPC_CHANNEL,
  type AlarmPushRpcCall,
} from './alarm-push-status-view.ts'

export const IM_DELIVERY_CATALOG_ENDPOINT = 'im-delivery.catalog'

export interface ImDeliveryCatalogOption {
  botId: string
  targetId: string
  name: string
  kind: string
  channel: string
}

export interface ImDeliveryCatalog {
  available: boolean
  options: ImDeliveryCatalogOption[]
  hint: string
  loading: boolean
}

export const EMPTY_IM_DELIVERY_CATALOG: ImDeliveryCatalog = {
  available: true,
  options: [],
  hint: '',
  loading: false,
}

/**
 * @param value - RPC catalog payload.
 */
export function asImDeliveryCatalog(value: unknown): ImDeliveryCatalog {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ...EMPTY_IM_DELIVERY_CATALOG, available: false }
  }
  const row = value as Record<string, unknown>
  const raw = Array.isArray(row.options) ? row.options : []
  const options: ImDeliveryCatalogOption[] = []
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue
    const item = entry as Record<string, unknown>
    const botId = typeof item.botId === 'string' ? item.botId.trim() : ''
    const targetId = typeof item.targetId === 'string' ? item.targetId.trim() : ''
    if (!botId || !targetId) continue
    options.push({
      botId,
      targetId,
      name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : targetId,
      kind: typeof item.kind === 'string' ? item.kind : '',
      channel: typeof item.channel === 'string' ? item.channel : 'im',
    })
  }
  return {
    available: row.available !== false,
    options,
    hint: typeof row.hint === 'string' ? row.hint : '',
    loading: false,
  }
}

/**
 * @param call - `ctx.connection.rpc.call`.
 * @param signal - optional abort.
 */
export async function fetchImDeliveryCatalog(
  call: AlarmPushRpcCall,
  signal?: AbortSignal,
): Promise<ImDeliveryCatalog> {
  const result = await call(NETXOPS_RPC_CHANNEL, IM_DELIVERY_CATALOG_ENDPOINT, {}, signal)
  if (result !== null && typeof result === 'object' && (result as { ok?: boolean }).ok === true) {
    return asImDeliveryCatalog((result as { value?: unknown }).value)
  }
  if (result !== null && typeof result === 'object' && (result as { ok?: boolean }).ok === false) {
    return {
      ...EMPTY_IM_DELIVERY_CATALOG,
      available: false,
      hint: String((result as { error?: { message?: string } }).error?.message ?? 'rpc failed'),
    }
  }
  return asImDeliveryCatalog(result)
}

/** Stable select value for one catalog row. */
export function imCatalogOptionKey(botId: string, targetId: string): string {
  return `${botId}::${targetId}`
}

/** Parse {@link imCatalogOptionKey}. */
export function parseImCatalogOptionKey(value: string): { botId: string, targetId: string } {
  const at = value.indexOf('::')
  if (at <= 0) return { botId: '', targetId: '' }
  return { botId: value.slice(0, at), targetId: value.slice(at + 2) }
}
