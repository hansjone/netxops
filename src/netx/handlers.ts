/**
 * netx REST tool handlers — port of packages/netx-mcp http_tools.py.
 */

import { type NetxClient, quoteNeId, type NetxJson } from './http.ts'

const EXEC_MAX_COMMANDS = 5

const UME_RAW_FIELD_PRESETS: Record<string, string[]> = {
  brief: [
    'alarm_alarm_key', 'alarm_host_name', 'alarm_perceived_severity', 'alarm_event_type',
    'alarm_last_seen_at', 'ne_host_name', 'ne_user_label', 'ne_ne_name', 'ne_ip_address', 'ne_exists',
  ],
  evidence: [
    'alarm_alarm_key', 'alarm_host_name', 'alarm_object_name', 'alarm_event_type',
    'alarm_native_probable_cause', 'alarm_perceived_severity', 'alarm_is_cleared',
    'alarm_time_created', 'alarm_last_seen_at', 'ne_host_name', 'ne_user_label',
    'ne_ne_name', 'ne_ip_address', 'ne_connection_status', 'ne_exists',
  ],
  ne_debug: [
    'alarm_alarm_key', 'alarm_ne_id', 'alarm_perceived_severity', 'alarm_last_seen_at',
    'ne_user_label', 'ne_ne_name', 'ne_ip_address', 'ne_ipv6_address', 'ne_device_level',
    'ne_host_name', 'ne_connection_status', 'ne_admin_status', 'ne_address_type',
    'ne_maintain_status', 'ne_exists',
  ],
}

function asRecord(value: unknown): NetxJson {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as NetxJson
    : {}
}

function str(args: NetxJson, key: string, fallback = ''): string {
  const v = args[key]
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return fallback
}

/** Prefer generic `nms_*` aliases; fall back to historical `ume_*` wire names. */
function nmsOrUme(args: NetxJson, nmsKey: string, umeKey: string): string {
  return str(args, nmsKey).trim() || str(args, umeKey).trim()
}

function nmsOrUmeList(args: NetxJson, nmsKey: string, umeKey: string): string[] {
  const primary = strList(args, nmsKey)
  return primary.length > 0 ? primary : strList(args, umeKey)
}

function num(args: NetxJson, key: string): number | undefined {
  const v = args[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function bool(args: NetxJson, key: string): boolean | undefined {
  const v = args[key]
  return typeof v === 'boolean' ? v : undefined
}

function strList(args: NetxJson, key: string): string[] {
  const v = args[key]
  if (!Array.isArray(v)) return []
  return v.map(x => String(x).trim()).filter(x => x.length > 0)
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  const n = value === undefined ? fallback : Math.trunc(value)
  return Math.max(min, Math.min(max, n))
}

function putStr(
  params: Record<string, string | number | boolean>,
  args: NetxJson,
  keys: string[],
): void {
  for (const key of keys) {
    const v = str(args, key).trim()
    if (v) params[key] = v
  }
}

export async function queryUmeAlarms(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  let page = clampInt(num(args, 'page'), 1, 1, 2)
  const pageSize = clampInt(num(args, 'page_size'), 50, 1, 500)
  const params: Record<string, string | number | boolean> = { page, page_size: pageSize }
  putStr(params, args, ['severity', 'ne_id', 'host_name', 'time_from', 'time_to'])
  const keyword = str(args, 'keyword').trim()
  const neName = str(args, 'ne_name').trim()
  if (keyword) params.keyword = keyword
  else if (neName) params.keyword = neName
  return client.get('/v1/ume/alarms', params, signal)
}

export async function aggregateUmeAlarmsRaw(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const params: Record<string, string | number | boolean> = {}
  putStr(params, args, [
    'group_by', 'group_by2', 'severity', 'is_cleared', 'ne_id', 'event_type',
    'keyword', 'time_from', 'time_to', 'limit',
  ])
  if ('exclude_missing_host' in args) {
    const flag = bool(args, 'exclude_missing_host')
    if (flag !== undefined) params.exclude_missing_host = flag
  }
  return client.get('/v1/ume/alarms/aggregate/raw', params, signal)
}

export async function aggregateUmeAlarms(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  if (str(args, 'group_by').trim()) return aggregateUmeAlarmsRaw(client, args, signal)
  const topNe = clampInt(num(args, 'top_ne'), 50, 0, 500)
  const params: Record<string, string | number | boolean> = { top_ne: topNe }
  if ('exclude_missing_host' in args) {
    const flag = bool(args, 'exclude_missing_host')
    if (flag !== undefined) params.exclude_missing_host = flag
  }
  putStr(params, args, ['severity', 'time_from', 'time_to'])
  return client.get('/v1/ume/alarms/aggregate', params, signal)
}

export async function runUmeDiagnostics(client: NetxClient, _args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  return client.get('/v1/ume/diagnostics', undefined, signal)
}

export async function queryUmeNeInventory(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const params: Record<string, string | number | boolean> = {
    page: clampInt(num(args, 'page'), 1, 1, Number.MAX_SAFE_INTEGER),
    page_size: clampInt(num(args, 'page_size'), 50, 1, 500),
  }
  putStr(params, args, ['keyword'])
  return client.get('/v1/ume/inventory/ne', params, signal)
}

export async function getUmeNe(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const neId = str(args, 'ne_id').trim()
  if (!neId) return { ok: false, error: 'ne_id_required', error_code: 'ne_id_required' }
  return client.get(`/v1/ume/inventory/ne/${quoteNeId(neId)}`, undefined, signal)
}

export async function queryUmeAlarmsRaw(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const params: Record<string, string | number | boolean> = {
    page: clampInt(num(args, 'page'), 1, 1, Number.MAX_SAFE_INTEGER),
    page_size: clampInt(num(args, 'page_size'), 50, 1, 500),
  }
  putStr(params, args, [
    'severity', 'is_cleared', 'ne_id', 'event_type', 'keyword',
    'time_from', 'time_to', 'order_by', 'order',
  ])
  let fields = strList(args, 'select_fields')
  if (fields.length === 0) {
    const preset = str(args, 'field_preset').trim().toLowerCase()
    fields = UME_RAW_FIELD_PRESETS[preset] ?? []
  }
  if (fields.length > 0) params.select_fields = fields.join(',')
  return client.get('/v1/ume/alarms/raw', params, signal)
}

export async function listUmeAlarmFields(client: NetxClient, _args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  return client.get('/v1/ume/alarms/fields', undefined, signal)
}

export async function sqlQueryUme(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const sql = str(args, 'sql').trim()
  if (!sql) return { ok: false, error: 'sql_required' }
  const limit = clampInt(num(args, 'limit'), 200, 1, 2000)
  const statementTimeoutMs = clampInt(num(args, 'statement_timeout_ms'), 0, 0, 30_000)
  return client.post('/v1/sql/ume_query', {
    sql,
    limit,
    statement_timeout_ms: statementTimeoutMs,
  }, signal, 60_000)
}

export async function listManagedNe(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const keyword = str(args, 'keyword').trim()
  const vendor = str(args, 'vendor').trim()
  const connectStatus = str(args, 'connect_status').trim()
  if (!(keyword || vendor || connectStatus)) {
    return { ok: false, error: 'managed_ne_filter_required', error_code: 'managed_ne_filter_required' }
  }
  if (keyword && keyword.length < 2) {
    return { ok: false, error: 'managed_ne_keyword_too_short', error_code: 'managed_ne_keyword_too_short' }
  }
  const params: Record<string, string | number | boolean> = {
    page: clampInt(num(args, 'page'), 1, 1, Number.MAX_SAFE_INTEGER),
    page_size: clampInt(num(args, 'page_size'), 20, 1, 100),
  }
  if (keyword) params.keyword = keyword
  if (vendor) params.vendor = vendor
  if (connectStatus) params.connect_status = connectStatus
  return client.get('/v1/managed-ne', params, signal)
}

export async function getManagedNe(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const neId = (
    str(args, 'ne_id') || str(args, 'managed_ne_id') || str(args, 'id')
  ).trim()
  if (!neId) {
    return {
      ok: false,
      error: 'ne_id_required',
      error_code: 'ne_id_required',
      hint: 'Pass managed NE id from listManagedNe/listCliTargets (source=managed). For NMS inventory UUIDs use execManagedNe(nms_ne_id=...) or getNmsNe, not getManagedNe.',
      example: { ne_id: '<managed-ne-uuid-from-listManagedNe>' },
    }
  }
  const out = await client.get(`/v1/managed-ne/${quoteNeId(neId)}`, undefined, signal)
  if (out.ok === false) {
    const detail = `${str(out, 'detail')}${str(out, 'error')}`.toLowerCase()
    if (detail.includes('404') || detail.includes('not_found') || detail.includes('not found') || out.error === 'netx_http_404') {
      return {
        ...out,
        hint: 'Managed NE not found for this ne_id. Call listManagedNe(keyword=...) or listCliTargets(source=managed) first. If this is an NMS inventory id, use execManagedNe(nms_ne_id=...) / getNmsNe instead of getManagedNe.',
      }
    }
  }
  return out
}

export async function execManagedNe(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const targetsRaw = args.targets
  const neIds = strList(args, 'ne_ids')
  const umeNeIds = nmsOrUmeList(args, 'nms_ne_ids', 'ume_ne_ids')
  const sharedCommands = strList(args, 'commands')
  const multi = (Array.isArray(targetsRaw) && targetsRaw.length > 0)
    || neIds.length > 0
    || umeNeIds.length > 0

  if (multi) {
    const body: NetxJson = {}
    if (Array.isArray(targetsRaw) && targetsRaw.length > 0) {
      const cleaned: NetxJson[] = []
      for (const t of targetsRaw) {
        if (typeof t !== 'object' || t === null || Array.isArray(t)) continue
        const row = t as NetxJson
        const item: NetxJson = {}
        const neId = str(row, 'ne_id').trim()
        const umeNeId = nmsOrUme(row, 'nms_ne_id', 'ume_ne_id')
        if (neId) item.ne_id = neId
        if (umeNeId) item.ume_ne_id = umeNeId
        const cmds = Array.isArray(row.commands)
          ? row.commands.map(c => String(c).trim()).filter(c => c.length > 0)
          : []
        if (cmds.length > 0) item.commands = cmds
        if (Object.keys(item).length > 0) cleaned.push(item)
      }
      body.targets = cleaned
    }
    if (neIds.length > 0) body.ne_ids = neIds
    if (umeNeIds.length > 0) body.ume_ne_ids = umeNeIds
    if (sharedCommands.length > 0) {
      if (sharedCommands.length > EXEC_MAX_COMMANDS) {
        return { ok: false, error: 'too_many_commands', error_code: 'too_many_commands' }
      }
      body.commands = sharedCommands
    }
    body.read_timeout_sec = clampInt(num(args, 'read_timeout_sec'), 60, 10, 120)
    const concurrency = num(args, 'concurrency')
    if (concurrency !== undefined) body.concurrency = clampInt(concurrency, 4, 1, 8)
    const out = await client.post('/v1/managed-ne/exec-batch', body, signal, 600_000)
    if (out.ok !== true) return out
    const data = asRecord(out.data)
    if (data.ok === false) {
      return { ok: false, data, error: str(data, 'error', 'exec_batch_failed') }
    }
    return { ok: true, data }
  }

  const neId = str(args, 'ne_id').trim()
  const umeNeId = nmsOrUme(args, 'nms_ne_id', 'ume_ne_id')
  if (Boolean(neId) === Boolean(umeNeId)) {
    return {
      ok: false,
      error: 'exactly_one_of_ne_id_or_nms_ne_id_required',
      error_code: 'exactly_one_of_ne_id_or_nms_ne_id_required',
      hint: 'For one NE pass ne_id OR nms_ne_id (alias ume_ne_id). For many NEs pass ne_ids / nms_ne_ids with shared commands, or targets[] — one call, concurrent on server.',
    }
  }
  if (sharedCommands.length === 0) {
    return { ok: false, error: 'commands_required', error_code: 'commands_required' }
  }
  if (sharedCommands.length > EXEC_MAX_COMMANDS) {
    return { ok: false, error: 'too_many_commands', error_code: 'too_many_commands' }
  }
  const body: NetxJson = {
    commands: sharedCommands,
    read_timeout_sec: clampInt(num(args, 'read_timeout_sec'), 60, 10, 120),
  }
  if (neId) body.ne_id = neId
  if (umeNeId) body.ume_ne_id = umeNeId
  const out = await client.post('/v1/managed-ne/exec', body, signal, 300_000)
  if (out.ok !== true) return out
  const data = asRecord(out.data)
  if (data.ok === false) {
    return { ok: false, data, error: str(data, 'error', 'exec_failed') }
  }
  return { ok: true, data }
}

export async function listCliTargets(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const params: Record<string, string | number | boolean> = {
    page: clampInt(num(args, 'page'), 1, 1, Number.MAX_SAFE_INTEGER),
    page_size: clampInt(num(args, 'page_size'), 50, 1, 500),
  }
  putStr(params, args, ['source', 'keyword'])
  return client.get('/v1/cli/targets', params, signal)
}

export async function findTopologyPaths(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const fromUid = nmsOrUme(args, 'from_nms_ne_id', 'from_ume_ne_id')
  const fromMid = str(args, 'from_managed_ne_id').trim()
  const toUid = nmsOrUme(args, 'to_nms_ne_id', 'to_ume_ne_id')
  const toMid = str(args, 'to_managed_ne_id').trim()
  if (Boolean(fromUid) === Boolean(fromMid)) {
    return { ok: false, error: 'exactly_one_of_from_nms_ne_id_or_from_managed_ne_id_required' }
  }
  if (Boolean(toUid) === Boolean(toMid)) {
    return { ok: false, error: 'exactly_one_of_to_nms_ne_id_or_to_managed_ne_id_required' }
  }
  let detail = str(args, 'detail', 'summary').trim().toLowerCase() || 'summary'
  if (detail !== 'summary' && detail !== 'full') detail = 'summary'
  const body: NetxJson = {
    max_paths: clampInt(num(args, 'max_paths'), 3, 1, 10),
    max_hops: clampInt(num(args, 'max_hops'), 6, 1, 12),
    layer: str(args, 'layer', 'physical').trim() || 'physical',
    detail,
  }
  if (fromUid) body.from_ume_ne_id = fromUid
  else body.from_managed_ne_id = fromMid
  if (toUid) body.to_ume_ne_id = toUid
  else body.to_managed_ne_id = toMid
  return client.post('/v1/topology/fabric/paths', body, signal, 30_000)
}
