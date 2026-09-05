/**
 * Topology canvas / fabric handlers — HTTP port of netx-topology-mcp tools.
 * Layout recipes (dual_unit / orbit / polish) stay MCP-local; DSH exposes HTTP
 * CRUD + fabric query + move_nodes, and returns a clear hint for recipe actions.
 */

import { type NetxClient, type NetxJson } from './http.ts'

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
  return v.map((x) => String(x).trim()).filter((x) => x.length > 0)
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  const n = value === undefined ? fallback : Math.trunc(value)
  return Math.max(min, Math.min(max, n))
}

function unwrap(out: NetxJson): NetxJson {
  if (out.ok !== true) return out
  const data = asRecord(out.data)
  if (Object.keys(data).length === 0) return { ok: true, data: out.data }
  return { ok: true, ...data, data }
}

function filterFields(args: NetxJson): NetxJson {
  const out: NetxJson = {}
  for (const key of ['keyword', 'role', 'vendor', 'link_status'] as const) {
    const v = str(args, key).trim()
    if (v) out[key] = v
  }
  return out
}

function edgeEndpoints(edge: NetxJson): [string, string] {
  const a = str(edge, 'a_node_id') || str(edge, 'a')
  const b = str(edge, 'b_node_id') || str(edge, 'b')
  return [a.trim(), b.trim()]
}

function collapseEdgesToLinks(edges: unknown[], includeNames = false): NetxJson[] {
  const buckets = new Map<string, NetxJson>()
  for (const raw of edges) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const e = raw as NetxJson
    const [a, b] = edgeEndpoints(e)
    if (!a || !b || a === b) continue
    const lo = a < b ? a : b
    const hi = a < b ? b : a
    const key = `${lo}\0${hi}`
    const row = buckets.get(key) ?? {
      a_node_id: lo,
      b_node_id: hi,
      link_count: 0,
    }
    row.link_count = Number(row.link_count || 0) + 1
    if (includeNames && !row.a_name) {
      if (a === lo) {
        row.a_name = str(e, 'a_name')
        row.b_name = str(e, 'b_name')
      } else {
        row.a_name = str(e, 'b_name')
        row.b_name = str(e, 'a_name')
      }
    }
    buckets.set(key, row)
  }
  return [...buckets.values()]
}

function summarizeViewGraph(graph: NetxJson, sample = 20): NetxJson {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : []
  const edges = Array.isArray(graph.edges) ? graph.edges : (Array.isArray(graph.links) ? graph.links : [])
  const sampleNodes = nodes.slice(0, Math.max(0, sample)).map((n) => {
    const row = asRecord(n)
    return {
      id: str(row, 'id') || str(row, 'fabric_node_id'),
      name: str(row, 'name'),
      x: row.x,
      y: row.y,
      level: row.level,
      role: row.role,
    }
  })
  return {
    ok: true,
    view_id: str(graph, 'id') || str(graph, 'view_id'),
    node_count: nodes.length,
    edge_count: edges.length,
    link_count: collapseEdgesToLinks(edges).length,
    links: collapseEdgesToLinks(edges),
    sample_nodes: sampleNodes,
    detail: 'summary',
  }
}

function layoutRecipeUnavailable(action: string): NetxJson {
  return {
    ok: false,
    error: 'layout_recipe_requires_netx_topology_mcp',
    action,
    hint: 'Canvas CRUD/query and move_nodes work in dsh-netxops. Dual-unit / orbit / polish recipes still need the netx-topology MCP layout engine (or enable that MCP alongside).',
  }
}

/** GET /v1/topology/tree */
export async function getTopologyTree(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const out = unwrap(await client.get('/v1/topology/tree', undefined, signal))
  if (out.ok !== true) return out
  const compact = bool(args, 'compact') !== false
  const maxDepth = num(args, 'max_depth')
  if (!compact && maxDepth === undefined) return out
  // Tree is already usable; pass through with flags for the model.
  return { ...out, compact, max_depth: maxDepth ?? null }
}

/** GET /v1/topology/views/{id} */
export async function getTopologyView(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const viewId = str(args, 'view_id').trim()
  if (!viewId) return { ok: false, error: 'view_id_required' }
  const out = unwrap(await client.get(`/v1/topology/views/${encodeURIComponent(viewId)}`, undefined, signal, 120_000))
  if (out.ok !== true) return out
  const detail = str(args, 'detail', 'summary').trim().toLowerCase() || 'summary'
  if (detail === 'full') return { ...out, detail: 'full' }
  return summarizeViewGraph(out, clampInt(num(args, 'sample'), 20, 0, 200))
}

/** POST /v1/topology/folders */
export async function createTopologyFolder(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const name = str(args, 'name').trim()
  if (!name) return { ok: false, error: 'name_required' }
  const body: NetxJson = { name }
  const parentId = str(args, 'parent_id').trim()
  if (parentId) body.parent_id = parentId
  const locale = str(args, 'locale').trim()
  if (locale) body.locale = locale
  if (num(args, 'sort_order') !== undefined) body.sort_order = Math.trunc(num(args, 'sort_order')!)
  return unwrap(await client.post('/v1/topology/folders', body, signal))
}

/** POST /v1/topology/views/{id}/nodes */
export async function addTopologyViewNodes(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const viewId = str(args, 'view_id').trim()
  if (!viewId) return { ok: false, error: 'view_id_required' }
  if (strList(args, 'managed_ne_ids').length || strList(args, 'ume_ne_ids').length) {
    return {
      ok: false,
      error: 'fabric_nodes_only',
      detail: 'Use keyword/role/vendor/link_status or fabric_node_ids; never managed/UME ids.',
    }
  }
  const filters = filterFields(args)
  const fabricIds = strList(args, 'fabric_node_ids')
  if (Object.keys(filters).length === 0 && fabricIds.length === 0) {
    return {
      ok: false,
      error: 'filter_or_fabric_node_ids_required',
      detail: 'Pass keyword/role/vendor/link_status (preferred) or fabric_node_ids.',
    }
  }
  if (num(args, 'max_nodes') !== undefined) {
    const got = unwrap(await client.get(`/v1/topology/views/${encodeURIComponent(viewId)}`, undefined, signal))
    if (got.ok === true) {
      const data = asRecord(got.data)
      const filt = asRecord(got.filter ?? data.filter)
      const membership = asRecord(filt.membership ?? {})
      membership.max_nodes = clampInt(num(args, 'max_nodes'), 2000, 1, 2000)
      filt.membership = membership
      await client.patch(`/v1/topology/views/${encodeURIComponent(viewId)}`, { filter: filt }, signal)
    }
  }
  const layout = str(args, 'layout', 'grid').trim() || 'grid'
  const body: NetxJson = {
    managed_ne_ids: [],
    layout,
    ...filters,
  }
  if (fabricIds.length) body.fabric_node_ids = fabricIds
  if (num(args, 'limit') !== undefined) body.limit = clampInt(num(args, 'limit'), 500, 1, 2000)
  if (num(args, 'offset') !== undefined) body.offset = clampInt(num(args, 'offset'), 0, 0, Number.MAX_SAFE_INTEGER)
  return unwrap(await client.post(`/v1/topology/views/${encodeURIComponent(viewId)}/nodes`, body, signal, 180_000))
}

/** POST /v1/topology/views/{id}/nodes/remove */
export async function removeTopologyViewNodes(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const viewId = str(args, 'view_id').trim()
  if (!viewId) return { ok: false, error: 'view_id_required' }
  const body: NetxJson = { ...filterFields(args) }
  const fabricIds = strList(args, 'fabric_node_ids')
  if (fabricIds.length) body.fabric_node_ids = fabricIds
  return unwrap(await client.post(
    `/v1/topology/views/${encodeURIComponent(viewId)}/nodes/remove`,
    body,
    signal,
  ))
}

/** Clone placements from source view onto target view. */
export async function copyTopologyViewNodes(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const sourceId = str(args, 'source_view_id').trim()
  const targetId = str(args, 'target_view_id').trim()
  if (!sourceId || !targetId) {
    return { ok: false, error: 'source_view_id_and_target_view_id_required' }
  }
  const source = unwrap(await client.get(`/v1/topology/views/${encodeURIComponent(sourceId)}`, undefined, signal, 120_000))
  if (source.ok !== true) return source
  const nodes = Array.isArray(source.nodes) ? source.nodes : []
  const limit = num(args, 'limit')
  const selected = typeof limit === 'number' ? nodes.slice(0, clampInt(limit, nodes.length, 1, 2000)) : nodes
  const fabricIds = selected.map((n) => {
    const row = asRecord(n)
    return str(row, 'id') || str(row, 'fabric_node_id')
  }).filter(Boolean)
  if (bool(args, 'dry_run') === true) {
    return { ok: true, dry_run: true, would_copy: fabricIds.length, source_view_id: sourceId, target_view_id: targetId }
  }
  if (bool(args, 'clear_target') === true) {
    await client.post(`/v1/topology/views/${encodeURIComponent(targetId)}/nodes/remove`, {
      fabric_node_ids: 'ALL',
      clear_all: true,
    }, signal)
  }
  if (fabricIds.length === 0) {
    return { ok: true, added: 0, source_view_id: sourceId, target_view_id: targetId }
  }
  const add = unwrap(await client.post(
    `/v1/topology/views/${encodeURIComponent(targetId)}/nodes`,
    { fabric_node_ids: fabricIds, layout: 'keep', managed_ne_ids: [] },
    signal,
    180_000,
  ))
  if (add.ok !== true) return add
  if (bool(args, 'copy_positions') !== false) {
    const ox = num(args, 'offset_x') ?? 0
    const oy = num(args, 'offset_y') ?? 0
    const positions = selected.map((n) => {
      const row = asRecord(n)
      const id = str(row, 'id') || str(row, 'fabric_node_id')
      return {
        fabric_node_id: id,
        x: Number(row.x || 0) + ox,
        y: Number(row.y || 0) + oy,
      }
    }).filter((p) => p.fabric_node_id)
    if (positions.length) {
      await client.patch(
        `/v1/topology/views/${encodeURIComponent(targetId)}/positions`,
        { positions },
        signal,
        120_000,
      )
    }
  }
  return { ok: true, added: fabricIds.length, source_view_id: sourceId, target_view_id: targetId, ...asRecord(add) }
}

/** PATCH /v1/topology/views/{id}/positions */
export async function updateTopologyViewPositions(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const viewId = str(args, 'view_id').trim()
  if (!viewId) return { ok: false, error: 'view_id_required' }
  const body: NetxJson = {}
  if (Array.isArray(args.positions)) body.positions = args.positions
  const layout = str(args, 'layout').trim()
  if (layout) body.layout = layout
  Object.assign(body, filterFields(args))
  for (const key of ['offset_x', 'offset_y', 'cols', 'gap_x', 'gap_y'] as const) {
    if (num(args, key) !== undefined) body[key] = num(args, key)
  }
  const fabricIds = strList(args, 'fabric_node_ids')
  if (fabricIds.length) body.fabric_node_ids = fabricIds
  return unwrap(await client.patch(
    `/v1/topology/views/${encodeURIComponent(viewId)}/positions`,
    body,
    signal,
    120_000,
  ))
}

/** POST .../project-neighbors */
export async function projectTopologyNeighbors(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const viewId = str(args, 'view_id').trim()
  if (!viewId) return { ok: false, error: 'view_id_required' }
  const body: NetxJson = {}
  const seeds = strList(args, 'seed_fabric_node_ids').length
    ? strList(args, 'seed_fabric_node_ids')
    : strList(args, 'fabric_node_ids')
  if (seeds.length) body.seed_fabric_node_ids = seeds
  const mids = strList(args, 'managed_ne_ids')
  if (mids.length) body.managed_ne_ids = mids
  const region = str(args, 'region_folder_id').trim()
  if (region) body.region_folder_id = region
  const out = unwrap(await client.post(
    `/v1/topology/views/${encodeURIComponent(viewId)}/project-neighbors`,
    body,
    signal,
    180_000,
  ))
  if (out.ok !== true) return out
  const detail = str(args, 'detail', 'summary').trim().toLowerCase() || 'summary'
  if (detail === 'full' || detail === 'raw' || detail === 'graph') {
    return { ...out, detail: 'full', projected: true }
  }
  return { ...summarizeViewGraph(out, clampInt(num(args, 'sample'), 20, 0, 100)), projected: true, view_id: viewId }
}

/** Fabric inventory summary|list|search */
export async function queryTopologyFabricNodes(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  let mode = str(args, 'mode').trim().toLowerCase()
  const q = str(args, 'q').trim()
  const keyword = str(args, 'keyword').trim()
  if (!mode) {
    if (bool(args, 'summary') === true) mode = 'summary'
    else if (q) mode = 'search'
    else mode = 'list'
  }
  if (mode === 'summary' || mode === 'stats' || mode === 'count') {
    const out = unwrap(await client.get('/v1/topology/fabric/summary', undefined, signal))
    return out.ok === true ? { ...out, mode: 'summary' } : out
  }
  if (mode === 'search' || mode === 'find') {
    const needle = q || keyword
    if (!needle) return { ok: false, error: 'q_required', hint: 'mode=search needs q (or keyword).' }
    return unwrap(await client.get('/v1/topology/fabric/nodes/search', {
      q: needle,
      page: clampInt(num(args, 'page'), 1, 1, Number.MAX_SAFE_INTEGER),
      page_size: clampInt(num(args, 'page_size') ?? num(args, 'limit'), 50, 1, 200),
    }, signal))
  }
  const params: Record<string, string | number | boolean> = {
    page: clampInt(num(args, 'page'), 1, 1, Number.MAX_SAFE_INTEGER),
    page_size: clampInt(num(args, 'page_size') ?? num(args, 'limit'), 50, 1, 500),
  }
  for (const key of ['keyword', 'role', 'level', 'level_major', 'region_folder_id', 'link_status'] as const) {
    const v = str(args, key).trim() || (key === 'keyword' ? q : '')
    if (v) params[key] = v
  }
  const out = unwrap(await client.get('/v1/topology/fabric/nodes', params, signal))
  return out.ok === true ? { ...out, mode: 'list' } : out
}

/** Classify / tag fabric nodes */
export async function classifyTopologyFabricNodes(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const action = str(args, 'action').trim().toLowerCase()
  if (!action) return { ok: false, error: 'action_required' }
  if (action === 'match') {
    const pattern = str(args, 'pattern').trim() || str(args, 'q').trim()
    if (!pattern) return { ok: false, error: 'pattern_required' }
    return unwrap(await client.post('/v1/topology/fabric/nodes/match', {
      pattern,
      match_field: str(args, 'match_field', 'name').trim() || 'name',
      sample_limit: clampInt(num(args, 'sample_limit'), 50, 1, 200),
    }, signal))
  }
  if (action === 'tag') {
    const body: NetxJson = {
      fabric_node_ids: strList(args, 'fabric_node_ids'),
      dry_run: bool(args, 'dry_run') === true,
    }
    const pattern = str(args, 'pattern').trim() || str(args, 'q').trim()
    if (pattern) body.pattern = pattern
    if (args.level !== undefined) body.level = args.level
    const role = str(args, 'role').trim()
    if (role) body.role = role
    const region = str(args, 'region_folder_id').trim()
    if (region) body.region_folder_id = region
    if (bool(args, 'clear_region') === true) body.clear_region = true
    return unwrap(await client.post('/v1/topology/fabric/nodes/tags/bulk', body, signal))
  }
  if (action === 'patch') {
    const nodeId = str(args, 'fabric_node_id').trim() || str(args, 'node_id').trim()
    if (!nodeId) return { ok: false, error: 'fabric_node_id_required' }
    const body: NetxJson = {}
    if (args.level !== undefined) body.level = args.level
    const role = str(args, 'role').trim()
    if (role) body.role = role
    const region = str(args, 'region_folder_id').trim()
    if (region) body.region_folder_id = region
    if (bool(args, 'clear_region') === true) body.clear_region = true
    return unwrap(await client.patch(
      `/v1/topology/fabric/nodes/${encodeURIComponent(nodeId)}/tags`,
      body,
      signal,
    ))
  }
  if (action === 'unmatched') {
    return unwrap(await client.get('/v1/topology/classify/unmatched', {
      kind: str(args, 'kind', 'any').trim() || 'any',
      page: clampInt(num(args, 'page'), 1, 1, Number.MAX_SAFE_INTEGER),
      page_size: clampInt(num(args, 'page_size') ?? num(args, 'limit'), 50, 1, 500),
    }, signal))
  }
  if (action === 'preview_rules') {
    return unwrap(await client.post('/v1/topology/classify/preview', {}, signal))
  }
  if (action === 'apply_rules') {
    const params: Record<string, string | number | boolean> = {}
    if (bool(args, 'overwrite_manual') === true) params.skip_manual = false
    else if (bool(args, 'skip_manual') !== undefined) params.skip_manual = bool(args, 'skip_manual') !== false
    if (bool(args, 'fill_empty_only') === true) params.fill_empty_only = true
    return unwrap(await client.post('/v1/topology/classify/apply', {}, signal))
  }
  if (action === 'list_rules') {
    return unwrap(await client.get('/v1/topology/classify/rules', undefined, signal))
  }
  return { ok: false, error: 'unknown_action', action }
}

/** GET /v1/topology/fabric/neighborhood */
export async function queryTopologyNeighborhood(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const nodeId = str(args, 'node_id').trim()
  if (!nodeId) return { ok: false, error: 'node_id_required' }
  const out = unwrap(await client.get('/v1/topology/fabric/neighborhood', {
    node_id: nodeId,
    depth: clampInt(num(args, 'depth'), 1, 1, 3),
    layer: str(args, 'layer', 'physical').trim() || 'physical',
  }, signal))
  if (out.ok !== true) return out
  const edges = Array.isArray(out.edges) ? out.edges : []
  return { ...out, links: collapseEdgesToLinks(edges) }
}

/** GET /v1/topology/fabric/edges */
export async function queryTopologyEdges(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const params: Record<string, string | number | boolean> = {
    page: clampInt(num(args, 'page'), 1, 1, Number.MAX_SAFE_INTEGER),
    page_size: clampInt(num(args, 'page_size'), 100, 1, 500),
    layer: str(args, 'layer', 'physical').trim() || 'physical',
  }
  for (const key of ['node_id', 'keyword', 'status', 'source'] as const) {
    const v = str(args, key).trim()
    if (v) params[key] = v
  }
  const out = unwrap(await client.get('/v1/topology/fabric/edges', params, signal))
  if (out.ok !== true) return out
  const detail = str(args, 'detail', 'adjacency').trim().toLowerCase() || 'adjacency'
  const items = Array.isArray(out.items) ? out.items : (Array.isArray(out.edges) ? out.edges : [])
  if (detail === 'ports') return { ...out, detail: 'ports', items }
  const links = collapseEdgesToLinks(items, true)
  return { ...out, detail: 'adjacency', links, items: undefined }
}

/** Simple degree-ranked hub suggestions (HTTP-only stand-in). */
export async function suggestSinkHubs(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const viewId = str(args, 'source_view_id').trim() || str(args, 'view_id').trim()
  if (!viewId) return { ok: false, error: 'source_view_id_required' }
  const out = unwrap(await client.get(`/v1/topology/views/${encodeURIComponent(viewId)}`, undefined, signal, 120_000))
  if (out.ok !== true) return out
  const nodes = Array.isArray(out.nodes) ? out.nodes : []
  const edges = Array.isArray(out.edges) ? out.edges : []
  const degree = new Map<string, number>()
  for (const raw of edges) {
    const [a, b] = edgeEndpoints(asRecord(raw))
    if (!a || !b) continue
    degree.set(a, (degree.get(a) || 0) + 1)
    degree.set(b, (degree.get(b) || 0) + 1)
  }
  const exclude = new Set([
    ...strList(args, 'exclude_portal_ids'),
    ...strList(args, 'exclude_fabric_node_ids'),
  ])
  const pick = clampInt(num(args, 'pick'), 5, 1, 50)
  const hubs = [...degree.entries()]
    .filter(([id]) => !exclude.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, pick)
    .map(([fabric_node_id, deg]) => {
      const node = nodes.find((n) => {
        const row = asRecord(n)
        return (str(row, 'id') || str(row, 'fabric_node_id')) === fabric_node_id
      })
      const row = asRecord(node)
      return {
        fabric_node_id,
        degree: deg,
        name: str(row, 'name'),
        level: row.level,
        role: row.role,
      }
    })
  return {
    ok: true,
    source_view_id: viewId,
    hubs,
    hint: 'Degree ranking only — full dual_unit-aware suggestSinkHubs lives in netx-topology MCP.',
  }
}

/** Basic layout QA from view graph (no Python layout_stats). */
export async function analyzeTopologyViewLayout(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  const viewId = str(args, 'view_id').trim()
  if (!viewId) {
    return {
      ok: false,
      error: 'view_id_required',
      hint: 'Pass view_id. folder_id sampling without view_id needs netx-topology MCP structure analysis.',
    }
  }
  const out = unwrap(await client.get(`/v1/topology/views/${encodeURIComponent(viewId)}`, undefined, signal, 120_000))
  if (out.ok !== true) return out
  const nodes = Array.isArray(out.nodes) ? out.nodes : []
  const edges = Array.isArray(out.edges) ? out.edges : []
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let missingxy = 0
  for (const raw of nodes) {
    const row = asRecord(raw)
    const x = Number(row.x)
    const y = Number(row.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      missingxy += 1
      continue
    }
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  const degree = new Map<string, number>()
  for (const raw of edges) {
    const [a, b] = edgeEndpoints(asRecord(raw))
    if (!a || !b) continue
    degree.set(a, (degree.get(a) || 0) + 1)
    degree.set(b, (degree.get(b) || 0) + 1)
  }
  const hubs = [...degree.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([id, deg]) => ({ fabric_node_id: id, degree: deg }))
  return {
    ok: true,
    view_id: viewId,
    detail: str(args, 'detail', 'summary') || 'summary',
    node_count: nodes.length,
    edge_count: edges.length,
    link_count: collapseEdgesToLinks(edges).length,
    missing_xy: missingxy,
    bbox: Number.isFinite(minX) ? { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY } : null,
    hubs,
    hint: 'Basic graph stats only. Crossing/dual_unit/score.total analysis needs netx-topology MCP.',
  }
}

/** Dual-unit sink requires MCP layout engine. */
export async function sinkTopologyDualUnits(_client: NetxClient, args: NetxJson): Promise<NetxJson> {
  return {
    ok: false,
    error: 'sink_dual_units_requires_netx_topology_mcp',
    source_view_id: str(args, 'source_view_id'),
    sink_view_id: str(args, 'sink_view_id'),
    hint: 'sinkTopologyDualUnits needs the dual_unit layout engine from netx-topology MCP. Use layoutTopologyView(action=move_nodes, park=true) for HTTP-only parking, or enable the topology MCP.',
  }
}

/** Layout tool: catalog + move_nodes over HTTP; recipes deferred to MCP. */
export async function layoutTopologyView(client: NetxClient, args: NetxJson, signal?: AbortSignal): Promise<NetxJson> {
  if (bool(args, 'catalog') === true) {
    return {
      ok: true,
      catalog: true,
      actions: [
        'layout', 'layout_dual_unit', 'move_nodes', 'sink_nodes', 'orbit_sweep', 'level_bands',
        'polish_crossings', 'clear_edge_hits', 'compact_bbox', 'pull_far_chains', 'align_reference',
        'fix_overlaps', 'resolve_overlaps', 'untangle', 'straighten_channels', 'job_status', 'job_cancel',
      ],
      dsh_supported: ['move_nodes', 'sink_nodes', 'catalog'],
      recipes: ['rings', 'corridor', 'compact', 'unstick'],
      hint: 'Only move_nodes/sink_nodes/catalog run in dsh-netxops; other actions need netx-topology MCP.',
    }
  }
  const action = str(args, 'action', 'layout').trim().toLowerCase() || 'layout'
  if (action === 'job_status' || action === 'job_cancel') {
    return {
      ok: false,
      error: 'layout_jobs_not_in_dsh_host',
      hint: 'Background layout jobs are owned by netx-topology MCP.',
    }
  }
  if (action === 'move_nodes' || action === 'sink_nodes') {
    const toId = str(args, 'view_id').trim()
    const fromId = str(args, 'source_view_id').trim()
    const ids = strList(args, 'fabric_node_ids')
    const params = asRecord(args.params)
    const fabricIds = ids.length ? ids : strList(params, 'fabric_node_ids')
    if (!toId || !fromId) {
      return { ok: false, error: 'view_id_and_source_view_id_required' }
    }
    if (fabricIds.length === 0) {
      return { ok: false, error: 'fabric_node_ids_required' }
    }
    const copyPositions = bool(params, 'copy_positions') !== false
      && bool(args, 'copy_positions') !== false
    const removeFromSource = bool(params, 'remove_from_source') !== false
    const source = unwrap(await client.get(`/v1/topology/views/${encodeURIComponent(fromId)}`, undefined, signal, 120_000))
    if (source.ok !== true) return source
    const nodes = Array.isArray(source.nodes) ? source.nodes : []
    const wanted = new Set(fabricIds)
    const selected = nodes.filter((n) => {
      const row = asRecord(n)
      const id = str(row, 'id') || str(row, 'fabric_node_id')
      return wanted.has(id)
    })
    const add = unwrap(await client.post(
      `/v1/topology/views/${encodeURIComponent(toId)}/nodes`,
      { fabric_node_ids: fabricIds, layout: copyPositions ? 'keep' : 'grid', managed_ne_ids: [] },
      signal,
      180_000,
    ))
    if (add.ok !== true) return add
    if (copyPositions && selected.length) {
      const ox = Number(params.offset_x || 0)
      const oy = Number(params.offset_y || 0)
      const positions = selected.map((n) => {
        const row = asRecord(n)
        return {
          fabric_node_id: str(row, 'id') || str(row, 'fabric_node_id'),
          x: Number(row.x || 0) + ox,
          y: Number(row.y || 0) + oy,
        }
      }).filter((p) => p.fabric_node_id)
      await client.patch(
        `/v1/topology/views/${encodeURIComponent(toId)}/positions`,
        { positions },
        signal,
        120_000,
      )
    }
    if (removeFromSource) {
      await client.post(
        `/v1/topology/views/${encodeURIComponent(fromId)}/nodes/remove`,
        { fabric_node_ids: fabricIds },
        signal,
      )
    }
    return {
      ok: true,
      action,
      moved: fabricIds.length,
      source_view_id: fromId,
      view_id: toId,
      park: bool(params, 'park') === true || bool(args, 'park') === true,
    }
  }
  return layoutRecipeUnavailable(action)
}
