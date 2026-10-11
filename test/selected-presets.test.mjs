import test from 'node:test'
import assert from 'node:assert/strict'
import { Context, Service } from '@deepseek-ai/cordis'
import { createScope, scopeOf } from '@deepseek-ai/dsh-scope'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { installPresetPublication } from '../src/netx/preset-publication.ts'
import { publishNetxConnection } from '../src/netx/runtime.ts'
import { capabilityGroupsFromSettings } from '../src/netx/capability-groups.ts'

const layers = new Map()
const skillLayers = new Map()
let live = []
class Tools extends Service {
  constructor(ctx) { super(ctx, 'tools') }
  register(entry) {
    const key = scopeOf(this.ctx)
    let layer = layers.get(key)
    if (!layer) layers.set(key, layer = new Map())
    if (layer.has(entry.name)) throw new Error(`duplicate tool ${entry.name}`)
    layer.set(entry.name, entry)
    return () => layer.delete(entry.name)
  }
}
class Skills extends Service {
  constructor(ctx) { super(ctx, 'skills') }
  register(entry) {
    const key = scopeOf(this.ctx)
    let layer = skillLayers.get(key)
    if (!layer) skillLayers.set(key, layer = new Map())
    if (layer.has(entry.name)) throw new Error(`duplicate skill ${entry.name}`)
    layer.set(entry.name, entry)
    return () => layer.delete(entry.name)
  }
}
class Agents extends Service {
  constructor(ctx) { super(ctx, 'agents') }
  list() { return live }
}
class Presets extends Service {
  constructor(ctx) { super(ctx, 'agentPresets') }
  composedPreset(ctx) { return ctx.presetId }
}
const wait = () => new Promise(resolve => setTimeout(resolve, 50))

test('selected publication uses each exact session scope and cleans up on off, switch, and unload', async t => {
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'netxops-selected-'))
  const ctx = new Context()
  const owners = []
  t.after(async () => {
    for (const owner of owners.reverse()) await owner.dispose()
    if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous
    layers.clear(); skillLayers.clear(); live = []
  })
  owners.push(await ctx.plugin(Tools))
  owners.push(await ctx.plugin(Skills))
  owners.push(await ctx.plugin(Agents))
  owners.push(await ctx.plugin(Presets))
  const scopes = []
  owners.push(await ctx.plugin(Object.assign(inner => {
    for (const id of ['standard', 'review']) {
      const key = {}
      const scope = createScope(inner, key)
      const agent = { id, ctx: scope.ctx.extend({ presetId: id }) }
      scopes.push({ key, scope, agent })
    }
  }, { inject: ['tools', 'skills'] })))
  live = scopes.map(row => row.agent)
  const publish = (overrides = {}) => publishNetxConnection({
    apiUrl: 'http://127.0.0.1:8890', token: '', lang: 'zh', toolCallTimeoutMs: 1000,
    toolsEnabled: true,
    groups: capabilityGroupsFromSettings({ groupOpsPresets: 'standard', groupBizMonitorInPreset: false }),
    groupKbInPreset: false, groupKbPresets: '', ...overrides,
  })
  publish()
  const owner = await ctx.plugin(installPresetPublication)
  owners.push(owner)
  await wait()
  assert.equal(layers.get(scopes[0].key)?.size, 15)
  assert.equal(skillLayers.get(scopes[0].key)?.has('netx-ops'), true)
  assert.equal(layers.get(scopes[1].key)?.size ?? 0, 0)
  publish({ toolsEnabled: false })
  await wait()
  assert.equal(layers.get(scopes[0].key)?.size, 0)
  assert.equal(skillLayers.get(scopes[0].key)?.size, 0)
  publish()
  await wait()
  assert.equal(layers.get(scopes[0].key)?.size, 15)
  scopes[0].agent.ctx = scopes[0].agent.ctx.extend({ presetId: 'review' })
  await ctx.serial('agent-preset/selected', 'standard', 'review')
  await wait()
  assert.equal(layers.get(scopes[0].key)?.size, 0)
  scopes[1].agent.ctx = scopes[1].agent.ctx.extend({ presetId: 'standard' })
  await ctx.serial('agent/created', { agent: scopes[1].agent })
  await wait()
  assert.equal(layers.get(scopes[1].key)?.size, 15)
  await owner.dispose()
  await wait()
  assert.equal(layers.get(scopes[1].key)?.size, 0)
  assert.equal(skillLayers.get(scopes[1].key)?.size, 0)
})
