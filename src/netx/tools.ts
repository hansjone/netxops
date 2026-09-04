/**
 * Register native DSH tools (`netx__*`) that call netx REST.
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { createNetxClient, type NetxClient, type NetxJson } from './http.ts'
import { getNetxConnection } from './runtime.ts'
import * as H from './handlers.ts'

export interface NetxToolConnection {
  apiUrl: string
  token: string
  lang: string
  toolCallTimeoutMs: number
}

type Handler = (client: NetxClient, args: NetxJson, signal?: AbortSignal) => Promise<NetxJson>

const str = (description?: string) => ({ type: 'string' as const, ...(description ? { description } : {}) })
const num = (description?: string) => ({ type: 'number' as const, ...(description ? { description } : {}) })
const bool = (description?: string) => ({ type: 'boolean' as const, ...(description ? { description } : {}) })
const strArr = (description?: string) => ({
  type: 'array' as const,
  items: { type: 'string' as const },
  ...(description ? { description } : {}),
})

function renderJson(_args: unknown, value: unknown) {
  return [{ type: 'text' as const, text: JSON.stringify(value, null, 0) }]
}

const jsonOut = {
  schema: { type: 'json' as const },
  render: renderJson,
}

function tool(
  name: string,
  description: string,
  parameters: Record<string, unknown>,
  handler: Handler,
  getClient: () => NetxClient,
  timeoutMs: number,
) {
  return defineTool({
    name,
    description,
    parameters: parameters as never,
    output: jsonOut,
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const result = await handler(getClient(), args as NetxJson, exec.signal)
      if (result.ok === false) {
        throw new Error(JSON.stringify(result))
      }
      return result
    },
  })
}

/**
 * Register all Netx Ops tools against the current connection snapshot.
 * Bearer is read from the live process store on each request (not frozen here).
 * @param ctx - host context with `tools`.
 * @param connection - apiUrl / token / lang / timeout (apiUrl/lang/timeout used for client base).
 * @returns disposer that unregisters every tool.
 */
export function registerNetxTools(ctx: Context, connection: NetxToolConnection): () => void {
  const client = createNetxClient({
    apiUrl: connection.apiUrl,
    lang: connection.lang,
    timeoutMs: Math.min(connection.toolCallTimeoutMs, 45_000),
    getToken: () => getNetxConnection()?.token ?? '',
  })
  const getClient = () => client
  const t = connection.toolCallTimeoutMs

  const disposers = [
    ctx.tools.register(tool(
      'netx__queryUmeAlarms',
      'Query UME current alarms (each row includes host_name). Supports severity/ne_id/host_name/keyword, last_seen time_from/time_to, pagination. Prefer host_name for display; ne_id is for filters only.',
      {
        severity: str(),
        ne_id: str('Filter only; do not show UUID to users'),
        host_name: str('Filter by NE host_name'),
        ne_name: str('Legacy alias mapped to keyword'),
        keyword: str('Substring on cause/object/event. Examples: LOS, Fiber Break, bandwidth, CRC.'),
        time_from: str('ISO time; filters last_seen_at >='),
        time_to: str('ISO time; filters last_seen_at <='),
        page: num(),
        page_size: num(),
      },
      H.queryUmeAlarms, getClient, t,
    )),
    ctx.tools.register(tool(
      'netx__aggregateUmeAlarms',
      'Aggregate UME current alarms (by_severity + top by_ne). If group_by is set, routes to aggregateUmeAlarmsRaw. Always filter severity/keyword/time before paging.',
      {
        severity: str('Optional perceived_severity filter (critical/major/minor/warning).'),
        top_ne: num('Max NE buckets (default 50). Ignored when group_by is set.'),
        exclude_missing_host: bool('Omit missing host_name from by_ne.'),
        time_from: str(),
        time_to: str(),
        group_by: str('When set, routes to raw aggregation. Prefer alarm_host_name.'),
        group_by2: str(),
        is_cleared: str(),
        ne_id: str(),
        event_type: str(),
        keyword: str(),
        limit: num(),
      },
      H.aggregateUmeAlarms, getClient, t,
    )),
    ctx.tools.register(tool(
      'netx__runUmeDiagnostics',
      'UME alarm diagnostics: severity, top_event_types, top_alarm_codes, top_ne, protocol buckets, freshness meta.',
      {},
      H.runUmeDiagnostics, getClient, t,
    )),
    ctx.tools.register(tool(
      'netx__queryUmeNeInventory',
      'Paged UME NE inventory synced in netx (keyword matches ne_id/ne_name/user_label/ip/host_name).',
      {
        keyword: str(),
        page: num(),
        page_size: num(),
      },
      H.queryUmeNeInventory, getClient, t,
    )),
    ctx.tools.register(tool(
      'netx__getUmeNe',
      'Get single UME NE detail by ne_id (UUID).',
      {
        ne_id: { type: 'string' as const, required: true as const, description: 'UME inventory ne_id (UUID).' },
      },
      H.getUmeNe, getClient, t,
    )),
    ctx.tools.register(tool(
      'netx__queryUmeAlarmsRaw',
      'Power query UME current alarms with full alarm_* + ne_* fields; optional field_preset or select_fields. Use field_preset=evidence for citations.',
      {
        severity: str(),
        is_cleared: str(),
        ne_id: str(),
        event_type: str(),
        keyword: str(),
        time_from: str(),
        time_to: str(),
        order_by: str('last_seen_at | time_created | perceived_severity | event_type | ne_id'),
        order: str('asc | desc'),
        select_fields: strArr(),
        field_preset: str('brief | evidence | ne_debug'),
        page: num(),
        page_size: num(),
      },
      H.queryUmeAlarmsRaw, getClient, t,
    )),
    ctx.tools.register(tool(
      'netx__aggregateUmeAlarmsRaw',
      'Dynamic aggregation on UME raw fields (group_by/group_by2); prefer alarm_host_name.',
      {
        group_by: { type: 'string' as const, required: true as const },
        group_by2: str(),
        severity: str(),
        is_cleared: str(),
        ne_id: str(),
        event_type: str(),
        keyword: str(),
        time_from: str(),
        time_to: str(),
        exclude_missing_host: bool(),
        limit: num(),
      },
      H.aggregateUmeAlarmsRaw, getClient, t,
    )),
    ctx.tools.register(tool(
      'netx__listUmeAlarmFields',
      'List available fields for UME raw alarm queries.',
      {},
      H.listUmeAlarmFields, getClient, t,
    )),
    ctx.tools.register(tool(
      'netx__sqlQueryUme',
      'Read-only SELECT on UME tables (ume_alarms_current/ume_inventory_ne); server enforces limits. Requires sql:query scope.',
      {
        sql: { type: 'string' as const, required: true as const },
        limit: num(),
        statement_timeout_ms: num(),
      },
      H.sqlQueryUme, getClient, t,
    )),
    ctx.tools.register(tool(
      'netx__listManagedNe',
      'List filtered netx managed NEs (keyword/vendor/connect_status required); use before execManagedNe.',
      {
        keyword: str(),
        vendor: str(),
        connect_status: str('unknown | testing | pass | fail'),
        page: num(),
        page_size: num(),
      },
      H.listManagedNe, getClient, t,
    )),
    ctx.tools.register(tool(
      'netx__getManagedNe',
      'Get one managed NE by managed ne_id (from listManagedNe / listCliTargets source=managed). Do NOT pass UME inventory UUID here.',
      {
        ne_id: str('Managed NE id'),
        managed_ne_id: str('Alias for ne_id'),
        id: str('Alias for ne_id'),
      },
      H.getManagedNe, getClient, t,
    )),
    ctx.tools.register(tool(
      'netx__execManagedNe',
      'Run read-only CLI via netx (show/display/ping/traceroute). Single NE: ne_id OR ume_ne_id + commands. Many NEs: ne_ids[]/ume_ne_ids[] + shared commands, or targets[{ume_ne_id|ne_id, commands}]. Do NOT loop one-NE calls for multi-NE work.',
      {
        ne_id: str(),
        ume_ne_id: str(),
        ne_ids: strArr('Managed NE ids for concurrent batch (shared commands).'),
        ume_ne_ids: strArr('UME inventory ne_ids for concurrent batch (shared commands).'),
        targets: {
          type: 'array' as const,
          description: 'Per-NE command sets: each item is one NE (ne_id OR ume_ne_id) with commands[].',
          items: {
            type: 'object' as const,
            additionalProperties: false,
            properties: {
              ne_id: str(),
              ume_ne_id: str(),
              commands: strArr(),
            },
          },
        },
        commands: strArr('Commands for single NE, or shared commands for batch.'),
        read_timeout_sec: num('Per-command read timeout (default 60; use 90–120 for slow show).'),
        concurrency: num('Parallel NEs for batch mode (1–8, default 4).'),
        async: bool('oclaw-only async hint; ignored by native REST client.'),
      },
      H.execManagedNe, getClient, Math.max(t, 300_000),
    )),
    ctx.tools.register(tool(
      'netx__listCliTargets',
      'List CLI-capable targets (managed NE and/or UME inventory). Call once per session with keyword/source, cache ids, then execManagedNe.',
      {
        source: str('managed | ume | all'),
        keyword: str(),
        page: num(),
        page_size: num(),
      },
      H.listCliTargets, getClient, t,
    )),
    ctx.tools.register(tool(
      'netx__findTopologyPaths',
      'Find up to max_paths simple paths between two fabric nodes. For each endpoint provide exactly one of ume_ne_id or managed_ne_id.',
      {
        from_ume_ne_id: str(),
        from_managed_ne_id: str(),
        to_ume_ne_id: str(),
        to_managed_ne_id: str(),
        max_paths: num(),
        max_hops: num(),
        layer: str(),
        detail: str('summary | full'),
      },
      H.findTopologyPaths, getClient, t,
    )),
  ]

  return () => {
    for (const dispose of disposers) dispose()
  }
}
