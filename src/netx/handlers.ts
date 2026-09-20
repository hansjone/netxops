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

// ── bizMonitor group (cutover / biz_state read) ─────────────────────────────

function taskBriefNe(brief: unknown): string {
  const rec = asRecord(brief)
  const name = typeof rec.ne_name === 'string' ? rec.ne_name.trim() : ''
  const ip = typeof rec.ne_ip === 'string' ? rec.ne_ip.trim() : ''
  if (name && ip) return `${name} (${ip})`
  return name || ip
}

function slimMigrationProject(row: NetxJson): NetxJson {
  const mt = asRecord(row.monitor_template)
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    note: row.note,
    monitor_template_id: row.monitor_template_id,
    monitor_template_name: typeof mt.name === 'string' ? mt.name : '',
    old_task_id: row.old_task_id,
    new_task_id: row.new_task_id,
    old_hf_task_id: row.old_hf_task_id,
    new_hf_task_id: row.new_hf_task_id,
    old_ne: taskBriefNe(row.old_task),
    new_ne: taskBriefNe(row.new_task),
    hf_interval_sec: row.hf_interval_sec,
    hf_start_at: row.hf_start_at,
    hf_end_at: row.hf_end_at,
    updated_at: row.updated_at,
  }
}

function matchesBizMonitorQ(row: NetxJson, q: string): boolean {
  if (!q) return true
  const hay = [
    row.id, row.name, row.note, row.status, row.ne_name, row.ne_ip, row.ne_id,
    row.old_ne, row.new_ne, row.monitor_template_name, row.purpose, row.vendor,
  ]
    .map((v) => (typeof v === 'string' || typeof v === 'number' ? String(v).toLowerCase() : ''))
    .join(' ')
  return hay.includes(q)
}

/**
 * Catalog entry: list cutover projects and/or biz_state tasks (no project_id required).
 * Use this first when the user did not give an id; then call getBizMonitorContext.
 */
export async function listBizMonitors(
  client: NetxClient,
  args: NetxJson,
  signal?: AbortSignal,
): Promise<NetxJson> {
  const kindRaw = str(args, 'kind', 'all').trim().toLowerCase() || 'all'
  const kind = kindRaw === 'project' ? 'projects'
    : kindRaw === 'task' ? 'tasks'
      : kindRaw
  if (kind !== 'all' && kind !== 'projects' && kind !== 'tasks') {
    return { ok: false, error: 'kind_invalid', detail: 'kind must be all|projects|tasks' }
  }
  const purpose = str(args, 'purpose').trim()
  const status = str(args, 'status').trim().toLowerCase()
  const q = str(args, 'q').trim().toLowerCase()
  const limit = clampInt(num(args, 'limit') ?? 100, 100, 1, 500)

  const wantProjects = kind === 'all' || kind === 'projects'
  const wantTasks = kind === 'all' || kind === 'tasks'

  const fetches: Array<Promise<NetxJson>> = []
  if (wantProjects) fetches.push(client.get('/v1/biz-migration/projects', {}, signal))
  else fetches.push(Promise.resolve({ ok: true, data: { items: [] } }))
  if (wantTasks) {
    const params: Record<string, string | number | boolean> = {}
    if (purpose) params.purpose = purpose
    fetches.push(client.get('/v1/biz-state/tasks', params, signal))
  } else {
    fetches.push(Promise.resolve({ ok: true, data: { items: [] } }))
  }

  const [projRes, taskRes] = await Promise.all(fetches)
  if (wantProjects && projRes.ok === false) return projRes
  if (wantTasks && taskRes.ok === false) return taskRes

  const projItems = Array.isArray(asRecord(projRes.data).items)
    ? (asRecord(projRes.data).items as unknown[])
    : []
  const taskItems = Array.isArray(asRecord(taskRes.data).items)
    ? (asRecord(taskRes.data).items as unknown[])
    : []

  let projects = projItems
    .map((row) => slimMigrationProject(asRecord(row)))
    .filter((row) => {
      if (status && String(row.status || '').toLowerCase() !== status) return false
      return matchesBizMonitorQ(row, q)
    })
  let tasks = taskItems
    .map((row) => asRecord(row))
    .filter((row) => {
      if (status && String(row.status || '').toLowerCase() !== status) return false
      return matchesBizMonitorQ(row, q)
    })

  const projectsTotal = projects.length
  const tasksTotal = tasks.length
  projects = projects.slice(0, limit)
  tasks = tasks.slice(0, limit)

  return {
    ok: true,
    data: {
      kind,
      projects: wantProjects ? projects : undefined,
      tasks: wantTasks ? tasks : undefined,
      counts: {
        projects: wantProjects ? projectsTotal : 0,
        tasks: wantTasks ? tasksTotal : 0,
        projects_returned: wantProjects ? projects.length : 0,
        tasks_returned: wantTasks ? tasks.length : 0,
      },
      next: 'Pass project_id (or task_id) to netx__getBizMonitorContext; then listBizMonitorBatches for batch_id / run_id.',
    },
  }
}

function slimCutoverBatch(row: NetxJson): NetxJson {
  return {
    id: row.id,
    project_id: row.project_id,
    batch_label: row.batch_label,
    status: row.status,
    accept_status: row.accept_status,
    accept_run_id: row.accept_run_id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function slimCollectBatch(row: NetxJson, taskId = ''): NetxJson {
  return {
    id: row.id,
    task_id: row.task_id || taskId,
    status: row.status,
    ne_name: row.ne_name,
    command_count: row.command_count,
    row_count: row.row_count,
    is_baseline: row.is_baseline,
    protected: row.protected,
    message: row.message,
    started_at: row.started_at,
    ended_at: row.ended_at,
  }
}

function slimEvalRun(row: NetxJson): NetxJson {
  const summary = asRecord(row.summary)
  const progress = asRecord(summary.progress)
  return {
    id: row.id,
    batch_id: row.batch_id,
    purpose: row.purpose,
    old_batch_id: row.old_batch_id,
    new_batch_id: row.new_batch_id,
    created_at: row.created_at,
    anomaly: summary.anomaly,
    progress_ok: progress.ok ?? summary.progress_ok,
    progress_total: progress.total ?? summary.progress_total,
  }
}

/**
 * List cutover batches, biz_state collect batches, and/or evaluate runs.
 * Needs project_id and/or task_id and/or cutover batch_id (for runs).
 */
export async function listBizMonitorBatches(
  client: NetxClient,
  args: NetxJson,
  signal?: AbortSignal,
): Promise<NetxJson> {
  const projectId = str(args, 'project_id').trim()
  const taskId = str(args, 'task_id').trim()
  const batchId = str(args, 'batch_id').trim()
  const kindRaw = str(args, 'kind', 'auto').trim().toLowerCase() || 'auto'
  const includeRuns = args.include_runs === true || args.include_runs === 'true' || args.include_runs === 1
  const status = str(args, 'status').trim().toLowerCase()
  const limit = clampInt(num(args, 'limit') ?? 50, 50, 1, 200)
  const runsLimit = clampInt(num(args, 'runs_limit') ?? 10, 10, 1, 50)

  let kind = kindRaw
  if (kind === 'auto') {
    if (batchId && !projectId && !taskId) kind = 'runs'
    else if (projectId && !taskId) kind = 'cutover'
    else if (taskId && !projectId) kind = 'collect'
    else if (projectId && taskId) kind = 'all'
    else if (batchId) kind = 'runs'
    else {
      return {
        ok: false,
        error: 'project_id_or_task_id_or_batch_id_required',
        detail: 'Pass project_id (cutover batches), task_id (collect batches), and/or batch_id (evaluate runs).',
      }
    }
  }
  if (!['auto', 'all', 'cutover', 'collect', 'runs'].includes(kind)) {
    return { ok: false, error: 'kind_invalid', detail: 'kind must be auto|all|cutover|collect|runs' }
  }

  const wantCutover = kind === 'all' || kind === 'cutover'
  const wantCollect = kind === 'all' || kind === 'collect'
  const wantRuns = kind === 'runs' || (includeRuns && (wantCutover || Boolean(batchId)))

  if (wantCutover && !projectId) {
    return { ok: false, error: 'project_id_required', detail: 'kind=cutover|all needs project_id' }
  }
  if (wantCollect && !taskId) {
    return { ok: false, error: 'task_id_required', detail: 'kind=collect|all needs task_id' }
  }
  if (kind === 'runs' && !batchId) {
    return { ok: false, error: 'batch_id_required', detail: 'kind=runs needs cutover batch_id' }
  }

  let cutoverBatches: NetxJson[] = []
  let collectBatches: NetxJson[] = []
  let runs: NetxJson[] = []

  if (wantCutover) {
    const res = await client.get(
      `/v1/biz-migration/projects/${encodeURIComponent(projectId)}/batches`,
      {},
      signal,
    )
    if (res.ok === false) return res
    const items = Array.isArray(asRecord(res.data).items)
      ? (asRecord(res.data).items as unknown[])
      : []
    cutoverBatches = items
      .map((row) => slimCutoverBatch(asRecord(row)))
      .filter((row) => {
        if (batchId && String(row.id || '') !== batchId) return false
        if (status && String(row.status || '').toLowerCase() !== status) return false
        return true
      })
      .slice(0, limit)
  }

  if (wantCollect) {
    const res = await client.get(
      `/v1/biz-state/tasks/${encodeURIComponent(taskId)}/batches`,
      { limit },
      signal,
    )
    if (res.ok === false) return res
    const items = Array.isArray(asRecord(res.data).items)
      ? (asRecord(res.data).items as unknown[])
      : []
    collectBatches = items
      .map((row) => slimCollectBatch(asRecord(row), taskId))
      .filter((row) => {
        if (status && String(row.status || '').toLowerCase() !== status) return false
        return true
      })
      .slice(0, limit)
  }

  if (wantRuns) {
    const runBatchIds = kind === 'runs'
      ? [batchId]
      : cutoverBatches.map((b) => String(b.id || '').trim()).filter(Boolean).slice(0, includeRuns ? 5 : 0)
    if (kind === 'runs' && batchId) {
      const res = await client.get(
        `/v1/biz-migration/batches/${encodeURIComponent(batchId)}/runs`,
        { limit: runsLimit },
        signal,
      )
      if (res.ok === false) return res
      const items = Array.isArray(asRecord(res.data).items)
        ? (asRecord(res.data).items as unknown[])
        : []
      runs = items.map((row) => slimEvalRun(asRecord(row))).slice(0, runsLimit)
    } else if (includeRuns && runBatchIds.length > 0) {
      const settled = await Promise.all(
        runBatchIds.map(async (id) => {
          const res = await client.get(
            `/v1/biz-migration/batches/${encodeURIComponent(id)}/runs`,
            { limit: runsLimit },
            signal,
          )
          if (res.ok === false) return { batch_id: id, error: res, items: [] as NetxJson[] }
          const items = Array.isArray(asRecord(res.data).items)
            ? (asRecord(res.data).items as unknown[])
            : []
          return {
            batch_id: id,
            items: items.map((row) => slimEvalRun(asRecord(row))).slice(0, runsLimit),
          }
        }),
      )
      for (const block of settled) {
        if ('error' in block && block.error) {
          // Keep listing batches even if one runs fetch fails; attach error note.
          const failed = cutoverBatches.find((b) => b.id === block.batch_id)
          if (failed) failed.runs_error = asRecord(block.error).error || 'runs_fetch_failed'
          continue
        }
        const target = cutoverBatches.find((b) => b.id === block.batch_id)
        if (target) target.runs = block.items
        for (const r of block.items) runs.push(r)
      }
    }
  }

  return {
    ok: true,
    data: {
      kind,
      project_id: projectId || undefined,
      task_id: taskId || undefined,
      batch_id: batchId || undefined,
      cutover_batches: wantCutover ? cutoverBatches : undefined,
      collect_batches: wantCollect ? collectBatches : undefined,
      runs: kind === 'runs' ? runs : undefined,
      counts: {
        cutover_batches: cutoverBatches.length,
        collect_batches: collectBatches.length,
        runs: runs.length,
      },
      next: wantCutover
        ? 'Use cutover batch id with netx__getBizMonitorBoard / listBizMonitorBatches(kind=runs). Collect batch id → netx__getBizCollectBatch.'
        : wantCollect
          ? 'Pass collect batch id to netx__getBizCollectBatch / getBizCollectCommandRaw.'
          : 'Pass run_id to netx__getBizMonitorDiffs or getBizMonitorBoard(run_id).',
    },
  }
}

/** Fat cutover / biz_state definition bundle (templates, mapping, tasks). */
export async function getBizMonitorContext(
  client: NetxClient,
  args: NetxJson,
  signal?: AbortSignal,
): Promise<NetxJson> {
  const projectId = str(args, 'project_id').trim()
  const taskId = str(args, 'task_id').trim()
  if (!projectId && !taskId) {
    return { ok: false, error: 'project_id_or_task_id_required' }
  }
  const params: Record<string, string | number | boolean> = {}
  if (projectId) params.project_id = projectId
  if (taskId) params.task_id = taskId
  return client.get('/v1/biz-migration/monitor-context', params, signal)
}

/** Cutover batch board + latest evaluate run summary. */
export async function getBizMonitorBoard(
  client: NetxClient,
  args: NetxJson,
  signal?: AbortSignal,
): Promise<NetxJson> {
  const batchId = str(args, 'batch_id').trim()
  if (!batchId) return { ok: false, error: 'batch_id_required' }
  const params: Record<string, string | number | boolean> = {}
  const runId = str(args, 'run_id').trim()
  if (runId) params.run_id = runId
  return client.get(`/v1/biz-migration/batches/${encodeURIComponent(batchId)}/board`, params, signal)
}

/** Red tickets with evidence (raw A/B + show command). */
export async function listBizMonitorReds(
  client: NetxClient,
  args: NetxJson,
  signal?: AbortSignal,
): Promise<NetxJson> {
  const projectId = str(args, 'project_id').trim()
  if (!projectId) return { ok: false, error: 'project_id_required' }
  const params: Record<string, string | number | boolean> = {}
  putStr(params, args, ['status'])
  const limit = num(args, 'limit')
  if (limit !== undefined) params.limit = clampInt(limit, 200, 1, 500)
  return client.get(
    `/v1/biz-migration/projects/${encodeURIComponent(projectId)}/red-tickets`,
    params,
    signal,
  )
}

/** Paged evaluate diffs (old_key/new_key = device-raw A/B). */
export async function getBizMonitorDiffs(
  client: NetxClient,
  args: NetxJson,
  signal?: AbortSignal,
): Promise<NetxJson> {
  const runId = str(args, 'run_id').trim()
  if (!runId) return { ok: false, error: 'run_id_required' }
  const params: Record<string, string | number | boolean> = {}
  putStr(params, args, ['metric_id', 'sheet_id', 'verdict', 'color', 'q'])
  const limit = num(args, 'limit')
  if (limit !== undefined) params.limit = clampInt(limit, 200, 1, 500)
  const offset = num(args, 'offset')
  if (offset !== undefined) params.offset = clampInt(offset, 0, 0, Number.MAX_SAFE_INTEGER)
  return client.get(`/v1/biz-migration/runs/${encodeURIComponent(runId)}/diffs`, params, signal)
}

/** One biz_state collect batch (commands + metrics). */
export async function getBizCollectBatch(
  client: NetxClient,
  args: NetxJson,
  signal?: AbortSignal,
): Promise<NetxJson> {
  const batchId = str(args, 'batch_id').trim()
  if (!batchId) return { ok: false, error: 'batch_id_required' }
  return client.get(`/v1/biz-state/batches/${encodeURIComponent(batchId)}`, {}, signal)
}

/** Full CLI raw_text for one collect command. */
export async function getBizCollectCommandRaw(
  client: NetxClient,
  args: NetxJson,
  signal?: AbortSignal,
): Promise<NetxJson> {
  const batchId = str(args, 'batch_id').trim()
  const commandId = str(args, 'command_id').trim()
  if (!batchId || !commandId) {
    return { ok: false, error: 'batch_id_and_command_id_required' }
  }
  return client.get(
    `/v1/biz-state/batches/${encodeURIComponent(batchId)}/commands/${encodeURIComponent(commandId)}`,
    {},
    signal,
  )
}
