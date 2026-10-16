/**
 * MCP catalog filtering: groups × disabledTools × readOnlyOnly.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'

import {
  filterCatalogTools,
  parseDisabledTools,
  resolveEnabledTools,
  disabledPublicNames,
} from '../src/netx/mcp-catalog.ts'
import { listMcpTools, callMcpTool, mcpEndpointUrl } from '../src/netx/mcp-remote.ts'
import { refreshMcpCatalog, getMcpCatalogState, resetMcpCatalog } from '../src/netx/mcp-store.ts'
import { DEFAULT_CAPABILITY_GROUPS } from '../src/netx/capability-groups.ts'

const SAMPLE = Object.freeze([
  {
    name: 'queryNmsAlarms',
    description: 'alarms',
    inputSchema: { type: 'object', properties: {} },
    readOnlyHint: true,
    group: 'ops',
  },
  {
    name: 'execManagedNe',
    description: 'cli',
    inputSchema: { type: 'object', properties: {} },
    readOnlyHint: false,
    group: 'ops',
  },
  {
    name: 'getTopologyTree',
    description: 'tree',
    inputSchema: { type: 'object', properties: {} },
    readOnlyHint: true,
    group: 'topology',
  },
  {
    name: 'listBizMonitors',
    description: 'biz',
    inputSchema: { type: 'object', properties: {} },
    readOnlyHint: true,
    group: 'bizMonitor',
  },
  {
    // Server later adds this under ops — must follow group default.
    name: 'brandNewOpsTool',
    description: 'new',
    inputSchema: { type: 'object', properties: {} },
    readOnlyHint: true,
    group: 'ops',
  },
])

test('parseDisabledTools accepts JSON and CSV', () => {
  assert.deepEqual(parseDisabledTools('["execManagedNe","x"]'), ['execManagedNe', 'x'])
  assert.deepEqual(parseDisabledTools('execManagedNe, queryNmsAlarms'), ['execManagedNe', 'queryNmsAlarms'])
  assert.deepEqual(parseDisabledTools('[]'), [])
})

test('group off drops all tools in that group', () => {
  const enabled = filterCatalogTools(SAMPLE, ['ops', 'bizMonitor'], {})
  assert.deepEqual(enabled.map((t) => t.name).sort(), [
    'brandNewOpsTool',
    'execManagedNe',
    'listBizMonitors',
    'queryNmsAlarms',
  ])
})

test('disabledTools opts out one tool while group stays on', () => {
  const enabled = filterCatalogTools(SAMPLE, ['ops'], { disabledTools: ['execManagedNe'] })
  assert.deepEqual(enabled.map((t) => t.name).sort(), ['brandNewOpsTool', 'queryNmsAlarms'])
})

test('readOnlyOnly drops writable tools', () => {
  const enabled = filterCatalogTools(SAMPLE, ['ops'], { readOnlyOnly: true })
  assert.deepEqual(enabled.map((t) => t.name).sort(), ['brandNewOpsTool', 'queryNmsAlarms'])
})

test('new server tool follows group default (not listed in disabledTools)', () => {
  const enabled = resolveEnabledTools(SAMPLE, {
    plane: 'preset',
    groups: DEFAULT_CAPABILITY_GROUPS,
    disabledTools: ['execManagedNe'],
  })
  const names = enabled.map((t) => t.name)
  assert.ok(names.includes('brandNewOpsTool'))
  assert.ok(names.includes('queryNmsAlarms'))
  assert.ok(names.includes('listBizMonitors'))
  assert.equal(names.includes('execManagedNe'), false)
  assert.equal(names.includes('getTopologyTree'), false) // topology inPreset default off
})

test('disabledPublicNames lists model-facing names for skill footnotes', () => {
  const names = disabledPublicNames(SAMPLE, ['ops'], ['execManagedNe'], true)
  assert.deepEqual(names, ['netx__execManagedNe'])
})

test('mcpEndpointUrl appends /mcp', () => {
  assert.equal(mcpEndpointUrl('http://127.0.0.1:8890'), 'http://127.0.0.1:8890/mcp')
  assert.equal(mcpEndpointUrl('http://127.0.0.1:8890/'), 'http://127.0.0.1:8890/mcp')
})

function startMockMcp(tools, { failList = false, token = 'secret' } = {}) {
  let callCount = 0
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(404)
      res.end()
      return
    }
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    const auth = req.headers.authorization ?? ''
    if (token && auth !== `Bearer ${token}`) {
      res.writeHead(401)
      res.end('unauthorized')
      return
    }
    const reply = (result) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id ?? 1, result }))
    }
    if (body.method === 'initialize') {
      reply({
        protocolVersion: '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: 'mock-netx', version: '0.0.0' },
      })
      return
    }
    if (body.method === 'notifications/initialized') {
      res.writeHead(202)
      res.end()
      return
    }
    if (body.method === 'tools/list') {
      if (failList) {
        res.writeHead(503)
        res.end('down')
        return
      }
      reply({
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: { readOnlyHint: t.readOnlyHint },
          _meta: { netx: { group: t.group } },
        })),
      })
      return
    }
    if (body.method === 'tools/call') {
      callCount += 1
      reply({
        content: [{ type: 'text', text: JSON.stringify({ ok: true, name: body.params?.name }) }],
        isError: false,
      })
      return
    }
    res.writeHead(400)
    res.end('unknown method')
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({
        server,
        url: `http://127.0.0.1:${port}/mcp`,
        apiUrl: `http://127.0.0.1:${port}`,
        callCount: () => callCount,
      })
    })
  })
}

test('listMcpTools + callMcpTool against mock Streamable HTTP server', async () => {
  const mock = await startMockMcp(SAMPLE)
  try {
    const tools = await listMcpTools({ mcpUrl: mock.url, token: 'secret' })
    assert.equal(tools.length, SAMPLE.length)
    assert.equal(tools.find((t) => t.name === 'execManagedNe')?.readOnlyHint, false)
    assert.equal(tools.find((t) => t.name === 'queryNmsAlarms')?.group, 'ops')
    const result = await callMcpTool({ mcpUrl: mock.url, token: 'secret' }, 'queryNmsAlarms', {})
    assert.equal(result.isError, undefined)
    assert.ok(Array.isArray(result.content))
    assert.ok(mock.callCount() >= 1)
  } finally {
    mock.server.close()
  }
})

test('refreshMcpCatalog keeps cache on disconnect', async () => {
  resetMcpCatalog()
  const mock = await startMockMcp(SAMPLE)
  try {
    const ok = await refreshMcpCatalog({ apiUrl: mock.apiUrl, token: 'secret' })
    assert.equal(ok.phase, 'connected')
    assert.equal(ok.tools.length, SAMPLE.length)
    assert.equal(ok.fromCache, false)
  } finally {
    mock.server.close()
  }

  const offline = await startMockMcp(SAMPLE, { failList: true })
  try {
    const next = await refreshMcpCatalog({ apiUrl: offline.apiUrl, token: 'secret' })
    assert.equal(next.phase, 'offline')
    assert.equal(next.fromCache, true)
    assert.equal(next.tools.length, SAMPLE.length)
    assert.ok(next.error)
    assert.equal(getMcpCatalogState().tools.length, SAMPLE.length)
  } finally {
    offline.server.close()
    resetMcpCatalog()
  }
})
