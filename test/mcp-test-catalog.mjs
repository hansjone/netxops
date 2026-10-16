/**
 * Seed the process-local MCP catalog for registration / publication tests.
 */

import { publishNetxConnection } from '../src/netx/runtime.ts'

const STORE_KEY = Symbol.for('dsh-netxops.mcp-catalog-store')

/** Classic ops catalog size (matches historical TOOLS_BY_GROUP.ops.length). */
export const OPS_TOOL_NAMES = Object.freeze([
  'queryNmsAlarms',
  'aggregateNmsAlarms',
  'runNmsDiagnostics',
  'queryNmsNeInventory',
  'getNmsNe',
  'queryNmsAlarmsRaw',
  'aggregateNmsAlarmsRaw',
  'listNmsAlarmFields',
  'sqlQueryNms',
  'listManagedNe',
  'getManagedNe',
  'execManagedNe',
  'getNeExecJob',
  'listCliTargets',
  'findTopologyPaths',
])

export const TOPOLOGY_TOOL_NAMES = Object.freeze([
  'getTopologyTree',
  'getTopologyView',
  'createTopologyFolder',
  'addTopologyViewNodes',
  'removeTopologyViewNodes',
  'copyTopologyViewNodes',
  'updateTopologyViewPositions',
  'projectTopologyNeighbors',
  'queryTopologyFabricNodes',
  'classifyTopologyFabricNodes',
  'queryTopologyNeighborhood',
  'queryTopologyEdges',
  'layoutTopologyView',
  'suggestSinkHubs',
  'analyzeTopologyViewLayout',
])

export const BIZ_MONITOR_TOOL_NAMES = Object.freeze([
  'listBizMonitors',
  'listBizMonitorBatches',
  'getBizMonitorContext',
  'getBizMonitorBoard',
  'listBizMonitorReds',
  'getBizMonitorDiffs',
  'getBizCollectBatch',
  'getBizCollectCommandRaw',
])

const WRITE_OPS = new Set(['execManagedNe'])
const WRITE_TOPOLOGY = new Set([
  'createTopologyFolder',
  'addTopologyViewNodes',
  'removeTopologyViewNodes',
  'copyTopologyViewNodes',
  'updateTopologyViewPositions',
  'projectTopologyNeighbors',
  'classifyTopologyFabricNodes',
  'layoutTopologyView',
])

function descriptor(name, group) {
  const write = (group === 'ops' && WRITE_OPS.has(name))
    || (group === 'topology' && WRITE_TOPOLOGY.has(name))
  return {
    name,
    description: name,
    inputSchema: { type: 'object', properties: {} },
    readOnlyHint: !write,
    group,
  }
}

export function fullCatalog() {
  return [
    ...OPS_TOOL_NAMES.map((name) => descriptor(name, 'ops')),
    ...TOPOLOGY_TOOL_NAMES.map((name) => descriptor(name, 'topology')),
    ...BIZ_MONITOR_TOOL_NAMES.map((name) => descriptor(name, 'bizMonitor')),
  ]
}

/** Install a frozen catalog into the shared Symbol.for store (no network). */
export function seedMcpCatalog(tools = fullCatalog()) {
  const root = globalThis
  const store = {
    state: {
      phase: 'connected',
      mcpUrl: 'http://127.0.0.1:8890/mcp',
      tools: Object.freeze([...tools]),
      error: '',
      listedAt: new Date().toISOString(),
      fromCache: false,
    },
    listeners: new Set(),
    generation: 1,
  }
  root[STORE_KEY] = store
  return store.state
}

export function clearMcpCatalogSeed() {
  delete globalThis[STORE_KEY]
}

/** Convenience: seed catalog + publish a connection snapshot. */
export function publishWithCatalog(connection) {
  seedMcpCatalog()
  publishNetxConnection(connection)
}
