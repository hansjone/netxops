/**
 * Group skills: MCP resources → disk cache → registerGroupSkills.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { registerGroupSkills } from '../src/netx/group-skills.ts'
import { refreshMcpCatalog, resetMcpCatalog } from '../src/netx/mcp-store.ts'
import { publishNetxConnection } from '../src/netx/runtime.ts'
import {
  hasSkillsCache,
  listCachedSkills,
  replaceSkillsCache,
  skillsCacheDir,
} from '../src/netx/skills-cache.ts'

const API = 'http://127.0.0.1:18890'
const OPS_SKILL = `---
name: netx-ops
description: Ops playbook for tests
---
# Ops

Use queryNmsAlarms.
`

const OPS_REF = '# Reference\n\nExtra detail.\n'
const TOPO_SKILL = `---
name: netx-topology
description: Topology playbook
---
# Topology
`

function skillResources(files) {
  return files.map((f) => ({
    uri: `netx://skills/${f.groupDir}/${f.skill}/${f.relPath}`,
    name: f.relPath,
    mimeType: 'text/markdown',
    ...(f.relPath === 'SKILL.md' ? { description: f.description || f.skill } : {}),
    _meta: {
      netx: {
        group: f.group,
        skill: f.skill,
        entry: f.relPath === 'SKILL.md',
      },
    },
    text: f.text,
  }))
}

function startMockMcp({
  tools = [{ name: 'queryNmsAlarms', description: 'alarms', readOnlyHint: true, group: 'ops' }],
  resources = null,
  failResources = false,
  token = 'secret',
} = {}) {
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
        capabilities: resources === null && !failResources
          ? { tools: {} }
          : { tools: {}, resources: {} },
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
      reply({
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: { type: 'object', properties: {} },
          annotations: { readOnlyHint: t.readOnlyHint !== false },
          _meta: { netx: { group: t.group } },
        })),
      })
      return
    }
    if (body.method === 'resources/list') {
      if (failResources) {
        res.writeHead(503)
        res.end('resources down')
        return
      }
      const list = Array.isArray(resources) ? resources : []
      reply({
        resources: list.map(({ text: _t, ...rest }) => rest),
      })
      return
    }
    if (body.method === 'resources/read') {
      if (failResources) {
        res.writeHead(503)
        res.end('resources down')
        return
      }
      const list = Array.isArray(resources) ? resources : []
      const hit = list.find((r) => r.uri === body.params?.uri)
      if (!hit) {
        res.writeHead(400)
        res.end('missing')
        return
      }
      reply({
        contents: [{ uri: hit.uri, mimeType: 'text/markdown', text: hit.text }],
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
        apiUrl: `http://127.0.0.1:${port}`,
        url: `http://127.0.0.1:${port}/mcp`,
      })
    })
  })
}

function fakeSkillsCtx() {
  /** @type {Array<{ name: string, content: string, path?: string, resourceBase?: { path: string } }>} */
  const registered = []
  const ctx = {
    skills: {
      register(skill) {
        registered.push(skill)
        return () => {}
      },
    },
    logger: { warn() {}, info() {} },
  }
  return { ctx, registered }
}

function withTempHome(t) {
  const previous = process.env.DSH_HOME
  const home = mkdtempSync(join(tmpdir(), 'netxops-skills-'))
  process.env.DSH_HOME = home
  t.after(() => {
    rmSync(home, { recursive: true, force: true })
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    resetMcpCatalog()
  })
  return home
}

const FULL_RESOURCES = skillResources([
  {
    group: 'ops',
    groupDir: 'ops',
    skill: 'netx-ops',
    relPath: 'SKILL.md',
    text: OPS_SKILL,
    description: 'Ops playbook for tests',
  },
  {
    group: 'ops',
    groupDir: 'ops',
    skill: 'netx-ops',
    relPath: 'reference.md',
    text: OPS_REF,
  },
  {
    group: 'topology',
    groupDir: 'topology',
    skill: 'netx-topology',
    relPath: 'SKILL.md',
    text: TOPO_SKILL,
    description: 'Topology playbook',
  },
])

test('refresh + register: normal skill with reference.md', async (t) => {
  withTempHome(t)
  const mock = await startMockMcp({ resources: FULL_RESOURCES })
  t.after(() => mock.server.close())
  publishNetxConnection({
    apiUrl: mock.apiUrl,
    token: 'secret',
    lang: 'zh',
    toolCallTimeoutMs: 5_000,
    toolsEnabled: true,
  })
  const catalog = await refreshMcpCatalog({ apiUrl: mock.apiUrl, token: 'secret' })
  assert.equal(catalog.phase, 'connected')
  assert.equal(catalog.tools.length, 1)
  const cache = skillsCacheDir(mock.apiUrl)
  assert.ok(existsSync(join(cache, 'ops', 'netx-ops', 'SKILL.md')))
  assert.ok(existsSync(join(cache, 'ops', 'netx-ops', 'reference.md')))
  assert.equal(readFileSync(join(cache, 'ops', 'netx-ops', 'reference.md'), 'utf8'), OPS_REF)

  const { ctx, registered } = fakeSkillsCtx()
  const dispose = await registerGroupSkills(ctx, ['ops'], 'test')
  assert.equal(registered.length, 1)
  assert.equal(registered[0].name, 'netx-ops')
  assert.match(registered[0].content, /queryNmsAlarms/)
  assert.equal(registered[0].resourceBase?.path, join(cache, 'ops', 'netx-ops'))
  assert.ok(registered[0].path?.endsWith('SKILL.md'))
  dispose()
})

test('server without resources capability → no skills, tools still ok', async (t) => {
  withTempHome(t)
  // Pre-seed stale cache that must be cleared on successful tools refresh.
  replaceSkillsCache(API, [{
    group: 'ops',
    skill: 'netx-ops',
    relPath: 'SKILL.md',
    text: OPS_SKILL,
  }])
  assert.equal(hasSkillsCache(API), true)

  const mock = await startMockMcp({ resources: null })
  t.after(() => mock.server.close())
  const catalog = await refreshMcpCatalog({ apiUrl: mock.apiUrl, token: 'secret' })
  assert.equal(catalog.phase, 'connected')
  assert.equal(catalog.tools.length, 1)
  assert.equal(hasSkillsCache(mock.apiUrl), false)

  publishNetxConnection({
    apiUrl: mock.apiUrl, token: 'secret', lang: 'zh', toolCallTimeoutMs: 5_000,
  })
  const { ctx, registered } = fakeSkillsCtx()
  await registerGroupSkills(ctx, ['ops'], 'test')
  assert.equal(registered.length, 0)
})

test('resources call failure keeps prior skill cache, tools still ok', async (t) => {
  withTempHome(t)
  const mock = await startMockMcp({ failResources: true })
  t.after(() => mock.server.close())
  replaceSkillsCache(mock.apiUrl, [{
    group: 'ops',
    skill: 'netx-ops',
    relPath: 'SKILL.md',
    text: OPS_SKILL,
  }])
  const catalog = await refreshMcpCatalog({ apiUrl: mock.apiUrl, token: 'secret' })
  assert.equal(catalog.phase, 'connected')
  assert.equal(catalog.tools.length, 1)
  assert.equal(hasSkillsCache(mock.apiUrl), true)
})

test('offline refresh keeps prior skill cache', async (t) => {
  withTempHome(t)
  const mock = await startMockMcp({ resources: FULL_RESOURCES })
  const ok = await refreshMcpCatalog({ apiUrl: mock.apiUrl, token: 'secret' })
  assert.equal(ok.phase, 'connected')
  mock.server.close()

  const offline = await startMockMcp({ failResources: true, tools: [] })
  // Fail tools/list entirely
  offline.server.close()
  const down = http.createServer((_req, res) => {
    res.writeHead(503)
    res.end('down')
  })
  await new Promise((resolve) => down.listen(0, '127.0.0.1', resolve))
  const { port } = down.address()
  t.after(() => down.close())
  // Same apiUrl as successful pull so cache key matches — use mock.apiUrl host
  // but port changed; instead keep using the first mock's cache by refreshing
  // the same apiUrl against a dead server.
  const deadUrl = mock.apiUrl
  const next = await refreshMcpCatalog({ apiUrl: deadUrl, token: 'secret', timeoutMs: 500 })
  assert.ok(next.phase === 'offline' || next.phase === 'error')
  assert.equal(hasSkillsCache(deadUrl), true)
  publishNetxConnection({
    apiUrl: deadUrl, token: 'secret', lang: 'zh', toolCallTimeoutMs: 5_000,
  })
  const { ctx, registered } = fakeSkillsCtx()
  await registerGroupSkills(ctx, ['ops'], 'test')
  assert.equal(registered[0]?.name, 'netx-ops')
})

test('refresh clears deleted skills from cache', async (t) => {
  withTempHome(t)
  const slim = skillResources([
    {
      group: 'ops',
      groupDir: 'ops',
      skill: 'netx-ops',
      relPath: 'SKILL.md',
      text: OPS_SKILL,
      description: 'Ops playbook for tests',
    },
  ])
  const mock = await startMockMcp({ resources: slim })
  t.after(() => mock.server.close())
  replaceSkillsCache(mock.apiUrl, [
    { group: 'ops', skill: 'netx-ops', relPath: 'SKILL.md', text: OPS_SKILL },
    { group: 'topology', skill: 'netx-topology', relPath: 'SKILL.md', text: TOPO_SKILL },
  ])
  assert.ok(existsSync(join(skillsCacheDir(mock.apiUrl), 'topology', 'netx-topology', 'SKILL.md')))
  await refreshMcpCatalog({ apiUrl: mock.apiUrl, token: 'secret' })
  assert.ok(existsSync(join(skillsCacheDir(mock.apiUrl), 'ops', 'netx-ops', 'SKILL.md')))
  assert.equal(existsSync(join(skillsCacheDir(mock.apiUrl), 'topology', 'netx-topology', 'SKILL.md')), false)
})

test('group off → skill not registered', async (t) => {
  withTempHome(t)
  replaceSkillsCache(API, [
    { group: 'ops', skill: 'netx-ops', relPath: 'SKILL.md', text: OPS_SKILL },
    { group: 'topology', skill: 'netx-topology', relPath: 'SKILL.md', text: TOPO_SKILL },
  ])
  publishNetxConnection({
    apiUrl: API, token: 'secret', lang: 'zh', toolCallTimeoutMs: 5_000,
  })
  const { ctx, registered } = fakeSkillsCtx()
  await registerGroupSkills(ctx, ['topology'], 'test')
  assert.equal(registered.length, 1)
  assert.equal(registered[0].name, 'netx-topology')
  registered.length = 0
  await registerGroupSkills(ctx, [], 'test')
  assert.equal(registered.length, 0)
})

test('listCachedSkills summarizes cached skills per group for the Plugins card', async (t) => {
  withTempHome(t)
  replaceSkillsCache(API, [
    { group: 'ops', skill: 'netx-ops', relPath: 'SKILL.md', text: OPS_SKILL },
    { group: 'ops', skill: 'netx-ops', relPath: 'reference.md', text: 'ref' },
    { group: 'bizMonitor', skill: 'netx-biz-monitor', relPath: 'SKILL.md', text: OPS_SKILL },
  ])
  const { listedAt, skills } = listCachedSkills(API)
  assert.ok(listedAt)
  assert.deepEqual(skills, [
    { group: 'ops', name: 'netx-ops', files: 2 },
    { group: 'bizMonitor', name: 'netx-biz-monitor', files: 1 },
  ])
  assert.deepEqual(listCachedSkills('').skills, [])
})
