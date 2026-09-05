/**
 * Register native DSH tools (`netx__*`) that call netx REST.
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  groupsForPlane,
  toolNamesForGroups,
  type NetxCapabilityGroupId,
  type NetxCapabilityGroups,
} from './capability-groups.ts'
import { createNetxClient, type NetxClient, type NetxJson } from './http.ts'
import { getNetxConnection } from './runtime.ts'
import * as H from './handlers.ts'
import * as T from './topology-handlers.ts'

export interface NetxToolConnection {
  apiUrl: string
  token: string
  lang: string
  toolCallTimeoutMs: number
  /** Capability-group exposure; omitted → package defaults. */
  groups?: NetxCapabilityGroups
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
/** Free-form JSON object — DSH requires an explicit additionalProperties boolean. */
const anyObj = (description?: string) => ({
  type: 'object' as const,
  additionalProperties: true as const,
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

export interface RegisterNetxToolsOptions {
  /**
   * `preset` — groups with `inPreset` (Netx Ops preset scope).
   * `public` — groups with `public` (host layer for other presets).
   */
  plane: 'preset' | 'public'
  /** Optional intersect with settings-enabled groups. */
  only?: readonly NetxCapabilityGroupId[]
  /** When set, register exactly these groups (ignore plane flags). */
  forceGroups?: readonly NetxCapabilityGroupId[]
}

/**
 * Register Netx Ops tools for one exposure plane against the connection snapshot.
 * Bearer is read from the live process store on each request (not frozen here).
 * @param ctx - context with `tools`.
 * @param connection - apiUrl / token / lang / timeout / groups.
 * @param options - which plane's group flags to honor.
 * @returns disposer that unregisters every tool.
 */
export function registerNetxTools(
  ctx: Context,
  connection: NetxToolConnection,
  options: RegisterNetxToolsOptions,
): () => void {
  const enabledGroups = options.forceGroups
    ?? groupsForPlane(connection.groups, options.plane, options.only)
  const allow = toolNamesForGroups(enabledGroups)
  if (allow.size === 0) return () => {}

  const client = createNetxClient({
    apiUrl: connection.apiUrl,
    lang: connection.lang,
    timeoutMs: Math.min(connection.toolCallTimeoutMs, 45_000),
    getToken: () => getNetxConnection()?.token ?? '',
  })
  const getClient = () => client
  const t = connection.toolCallTimeoutMs

  const catalog = [
    tool(
      'netx__queryNmsAlarms',
      'Query NMS current alarms (each row includes host_name). Supports severity/ne_id/host_name/keyword, last_seen time_from/time_to, pagination. Prefer host_name for display; ne_id is for filters only.',
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
    ),
    tool(
      'netx__aggregateNmsAlarms',
      'Aggregate NMS current alarms (by_severity + top by_ne). If group_by is set, routes to aggregateUmeAlarmsRaw. Always filter severity/keyword/time before paging.',
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
    ),
    tool(
      'netx__runNmsDiagnostics',
      'NMS alarm diagnostics: severity, top_event_types, top_alarm_codes, top_ne, protocol buckets, freshness meta.',
      {},
      H.runUmeDiagnostics, getClient, t,
    ),
    tool(
      'netx__queryNmsNeInventory',
      'Paged NMS NE inventory synced in netx (keyword matches ne_id/ne_name/user_label/ip/host_name).',
      {
        keyword: str(),
        page: num(),
        page_size: num(),
      },
      H.queryUmeNeInventory, getClient, t,
    ),
    tool(
      'netx__getNmsNe',
      'Get single NMS NE detail by ne_id (UUID).',
      {
        ne_id: { type: 'string' as const, required: true as const, description: 'NMS inventory ne_id (UUID).' },
      },
      H.getUmeNe, getClient, t,
    ),
    tool(
      'netx__queryNmsAlarmsRaw',
      'Power query NMS current alarms with full alarm_* + ne_* fields; optional field_preset or select_fields. Use field_preset=evidence for citations.',
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
    ),
    tool(
      'netx__aggregateNmsAlarmsRaw',
      'Dynamic aggregation on NMS raw fields (group_by/group_by2); prefer alarm_host_name.',
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
    ),
    tool(
      'netx__listNmsAlarmFields',
      'List available fields for NMS raw alarm queries.',
      {},
      H.listUmeAlarmFields, getClient, t,
    ),
    tool(
      'netx__sqlQueryNms',
      'Read-only SELECT on NMS tables (ume_alarms_current/ume_inventory_ne); server enforces limits. Requires sql:query scope.',
      {
        sql: { type: 'string' as const, required: true as const },
        limit: num(),
        statement_timeout_ms: num(),
      },
      H.sqlQueryUme, getClient, t,
    ),
    tool(
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
    ),
    tool(
      'netx__getManagedNe',
      'Get one managed NE by managed ne_id (from listManagedNe / listCliTargets source=managed). Do NOT pass NMS inventory UUID here.',
      {
        ne_id: str('Managed NE id'),
        managed_ne_id: str('Alias for ne_id'),
        id: str('Alias for ne_id'),
      },
      H.getManagedNe, getClient, t,
    ),
    tool(
      'netx__execManagedNe',
      'Run read-only CLI via netx (show/display/ping/traceroute). Single NE: ne_id OR ume_ne_id + commands. Many NEs: ne_ids[]/ume_ne_ids[] + shared commands, or targets[{ume_ne_id|ne_id, commands}]. Do NOT loop one-NE calls for multi-NE work.',
      {
        ne_id: str(),
        nms_ne_id: str('NMS inventory id; alias ume_ne_id'),
        ume_ne_id: str('Legacy alias of nms_ne_id'),
        ne_ids: strArr('Managed NE ids for concurrent batch (shared commands).'),
        nms_ne_ids: strArr('NMS inventory ids; alias ume_ne_ids'),
        ume_ne_ids: strArr('Legacy alias of nms_ne_ids'),
        targets: {
          type: 'array' as const,
          description: 'Per-NE command sets: each item is one NE (ne_id OR ume_ne_id) with commands[].',
          items: {
            type: 'object' as const,
            additionalProperties: false,
            properties: {
              ne_id: str(),
              nms_ne_id: str(),
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
    ),
    tool(
      'netx__listCliTargets',
      'List CLI-capable targets (managed NE and/or NMS inventory). Call once per session with keyword/source, cache ids, then execManagedNe.',
      {
        source: str('managed | nms | ume | all'),
        keyword: str(),
        page: num(),
        page_size: num(),
      },
      H.listCliTargets, getClient, t,
    ),
    tool(
      'netx__findTopologyPaths',
      'Find up to max_paths simple paths between two fabric nodes (common group — native netx, not NMS-bound). For each endpoint provide exactly one of ume_ne_id or managed_ne_id.',
      {
        from_nms_ne_id: str('NMS inventory id'),
        from_ume_ne_id: str('Legacy alias of from_nms_ne_id'),
        from_managed_ne_id: str(),
        to_nms_ne_id: str('NMS inventory id'),
        to_ume_ne_id: str('Legacy alias of to_nms_ne_id'),
        to_managed_ne_id: str(),
        max_paths: num(),
        max_hops: num(),
        layer: str(),
        detail: str('summary | full'),
      },
      H.findTopologyPaths, getClient, t,
    ),
    // ── topology group (netx-topology canvas / fabric) ─────────────────────
    tool(
      'netx__getTopologyTree',
      'Get topology folder tree (nav roots + Root map canvases). Start here before createTopologyFolder.',
      { compact: bool(), max_depth: num() },
      T.getTopologyTree, getClient, t,
    ),
    tool(
      'netx__getTopologyView',
      'Get a topology view by view_id. Default detail=summary with sample_nodes + links[].',
      {
        view_id: { type: 'string' as const, required: true as const },
        detail: str('summary | full'),
        sample: num(),
      },
      T.getTopologyView, getClient, t,
    ),
    tool(
      'netx__createTopologyFolder',
      'Create topology folders / region canvases. Only way to create canvases (ne:write).',
      {
        name: { type: 'string' as const, required: true as const },
        parent_id: str(),
        locale: str('zh | en'),
        sort_order: num(),
      },
      T.createTopologyFolder, getClient, t,
    ),
    tool(
      'netx__addTopologyViewNodes',
      'Bulk-place fabric nodes on a view via filters or fabric_node_ids (never managed/UME ids).',
      {
        view_id: { type: 'string' as const, required: true as const },
        max_nodes: num(),
        keyword: str(),
        role: str(),
        vendor: str(),
        link_status: str(),
        limit: num(),
        offset: num(),
        fabric_node_ids: strArr(),
        layout: str('grid | keep'),
      },
      T.addTopologyViewNodes, getClient, t,
    ),
    tool(
      'netx__removeTopologyViewNodes',
      'Remove placements from a view (not fabric) by filters or fabric_node_ids.',
      {
        view_id: { type: 'string' as const, required: true as const },
        keyword: str(),
        role: str(),
        vendor: str(),
        link_status: str(),
        fabric_node_ids: strArr(),
      },
      T.removeTopologyViewNodes, getClient, t,
    ),
    tool(
      'netx__copyTopologyViewNodes',
      'Clone fabric placements from source_view_id onto target_view_id (optional clear_target / copy_positions).',
      {
        source_view_id: { type: 'string' as const, required: true as const },
        target_view_id: { type: 'string' as const, required: true as const },
        copy_positions: bool(),
        clear_target: bool(),
        offset_x: num(),
        offset_y: num(),
        limit: num(),
        dry_run: bool(),
      },
      T.copyTopologyViewNodes, getClient, t,
    ),
    tool(
      'netx__updateTopologyViewPositions',
      'Move nodes on a view via positions[] or layout=grid|offset|stack + filters.',
      {
        view_id: { type: 'string' as const, required: true as const },
        positions: {
          type: 'array' as const,
          description: 'Manual placements: [{ fabric_node_id, x, y }, …]',
          items: {
            type: 'object' as const,
            additionalProperties: false,
            properties: {
              fabric_node_id: str(),
              x: num(),
              y: num(),
            },
          },
        },
        layout: str('grid | offset | stack'),
        keyword: str(),
        role: str(),
        vendor: str(),
        link_status: str(),
        fabric_node_ids: strArr(),
        offset_x: num(),
        offset_y: num(),
      },
      T.updateTopologyViewPositions, getClient, t,
    ),
    tool(
      'netx__projectTopologyNeighbors',
      'Project existing fabric neighbors of on-view nodes onto the canvas.',
      {
        view_id: { type: 'string' as const, required: true as const },
        seed_fabric_node_ids: strArr(),
        managed_ne_ids: strArr(),
        region_folder_id: str(),
        detail: str('summary | full'),
        sample: num(),
      },
      T.projectTopologyNeighbors, getClient, t,
    ),
    tool(
      'netx__queryTopologyFabricNodes',
      'Fabric inventory: mode=summary|list|search (keyword/role/level/region/link_status).',
      {
        mode: str('summary | list | search'),
        q: str(),
        keyword: str(),
        role: str(),
        level: str(),
        level_major: str(),
        region_folder_id: str(),
        link_status: str(),
        page: num(),
        page_size: num(),
        limit: num(),
        summary: bool(),
      },
      T.queryTopologyFabricNodes, getClient, t,
    ),
    tool(
      'netx__classifyTopologyFabricNodes',
      'Classify fabric nodes: action=match|tag|patch|unmatched|preview_rules|apply_rules|list_rules.',
      {
        action: { type: 'string' as const, required: true as const },
        pattern: str(),
        q: str(),
        match_field: str(),
        sample_limit: num(),
        fabric_node_ids: strArr(),
        fabric_node_id: str(),
        node_id: str(),
        level: str(),
        role: str(),
        region_folder_id: str(),
        clear_region: bool(),
        dry_run: bool(),
        kind: str(),
        page: num(),
        page_size: num(),
        skip_manual: bool(),
        overwrite_manual: bool(),
        fill_empty_only: bool(),
      },
      T.classifyTopologyFabricNodes, getClient, t,
    ),
    tool(
      'netx__queryTopologyNeighborhood',
      'Neighborhood around a fabric node (depth 1–3) with compact links[].',
      {
        node_id: { type: 'string' as const, required: true as const },
        depth: num(),
        layer: str(),
      },
      T.queryTopologyNeighborhood, getClient, t,
    ),
    tool(
      'netx__queryTopologyEdges',
      'Fabric adjacency links[] (detail=adjacency) or port rows (detail=ports).',
      {
        node_id: str(),
        keyword: str(),
        layer: str(),
        status: str(),
        source: str('lldp | ume | manual'),
        detail: str('adjacency | ports'),
        page: num(),
        page_size: num(),
      },
      T.queryTopologyEdges, getClient, t,
    ),
    tool(
      'netx__suggestSinkHubs',
      'Rank hub territories on a source view for non-dual move_nodes(park) batches (degree stand-in in DSH).',
      {
        source_view_id: str(),
        view_id: str(),
        pick: num(),
        exclude_portal_ids: strArr(),
        exclude_fabric_node_ids: strArr(),
      },
      T.suggestSinkHubs, getClient, t,
    ),
    tool(
      'netx__analyzeTopologyViewLayout',
      'Basic layout QA for a view (bbox/hubs). Full dual_unit/crossing scores need netx-topology MCP.',
      {
        view_id: str(),
        folder_id: str(),
        detail: str('summary | structure | hotspots | blocks | both'),
        score_profile: str(),
        sight_limit: num(),
        max_views: num(),
        min_nodes: num(),
        max_nodes: num(),
        with_meta: bool(),
      },
      T.analyzeTopologyViewLayout, getClient, t,
    ),
    tool(
      'netx__sinkTopologyDualUnits',
      'Drain dual_unit eyes from source to sink (requires netx-topology MCP layout engine in DSH).',
      {
        source_view_id: str(),
        sink_view_id: str(),
        max_units: num(),
        min_nodes: num(),
        max_nodes: num(),
        max_batch_nodes: num(),
        layout_batch: bool(),
        until_empty: bool(),
        dry_run: bool(),
      },
      T.sinkTopologyDualUnits, getClient, t,
    ),
    tool(
      'netx__layoutTopologyView',
      'Layout / polish a canvas. DSH supports catalog + move_nodes|sink_nodes over HTTP; dual_unit/orbit/polish recipes need netx-topology MCP.',
      {
        view_id: str(),
        action: str(),
        source_view_id: str(),
        recipe: str(),
        preset: str(),
        mode: str('preview | apply'),
        tune: bool(),
        params: anyObj('Action-specific options (move_nodes / recipes / polish).'),
        catalog: bool(),
        fabric_node_ids: strArr(),
        park: bool(),
        copy_positions: bool(),
      },
      T.layoutTopologyView, getClient, Math.max(t, 180_000),
    ),
  ]

  const disposers = catalog
    .filter((entry) => allow.has(entry.name))
    .map((entry) => ctx.tools.register(entry))

  return () => {
    for (const dispose of disposers) dispose()
  }
}
