import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as host from '../lib/index.js'
import { Context, Service } from '@deepseek-ai/cordis'
import { parsePresetIds, capabilityGroupsFromSettings, kbEnabledForPlane } from '../src/netx/capability-groups.ts'

// Exercise the current official Schema implementation, not merely the installed
// lib: this local Harness has newer source alongside an older scalar-only lib.
const peer = createRequire(import.meta.resolve('@deepseek-ai/schemastery'))
const cosmokitSource = peer.resolve('@deepseek-ai/cosmokit/src/index.ts')
const schemaSource = peer.resolve('@deepseek-ai/schemastery/src/index.ts')
const built = await Bun.build({ entrypoints: [schemaSource], target: 'bun', format: 'esm', plugins: [{
  name: 'official-volatile-source',
  setup(build) {
    build.onResolve({ filter: /^@deepseek-ai\/cosmokit$/ }, () => ({ path: cosmokitSource }))
  },
}] })
assert.equal(built.success, true, String(built.logs))
const schemaUrl = `data:text/javascript;base64,${Buffer.from(await built.outputs[0].text()).toString('base64')}`
// Load the shipped JS with the current official schema peer. Keep it beside
// lib/index.js so skill and package discovery use the same paths as production.
const hostFile = fileURLToPath(new URL('../lib/index.js', import.meta.url))
const currentHostFile = fileURLToPath(new URL(`../lib/.volatile-startup-${randomUUID()}.mjs`, import.meta.url))
const hostCode = readFileSync(hostFile, 'utf8')
const withCurrentSchema = hostCode.replace(/from ["']@deepseek-ai\/schemastery["']/g, `from '${schemaUrl}'`)
assert.notEqual(withCurrentSchema, hostCode, 'must replace the external schema peer')
writeFileSync(currentHostFile, withCurrentSchema)
after(() => unlinkSync(currentHostFile))
const currentHost = await import(pathToFileURL(currentHostFile).href)
const currentConfig = currentHost.Config
const { createVolatile, updateVolatile, isVolatile } = await import(pathToFileURL(peer.resolve('@deepseek-ai/cosmokit/src/volatile.ts')).href)
const store = () => globalThis[Symbol.for('dsh-netxops.connection-store')].connection
const pause = () => new Promise(resolve => setTimeout(resolve, 40))

function context(t, settings = { describe: () => [] }) {
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'netxops-volatile-'))
  const tools = new Map(), skills = new Map(), listeners = new Map(), prompts = new Map(), effects = [], injected = [], errors = []
  const register = map => entry => {
    assert.equal(map.has(entry.name), false, `duplicate ${entry.name}`)
    map.set(entry.name, entry)
    return () => map.delete(entry.name)
  }
  const ctx = {
    logger: { info() {}, warn() {}, error(...args) { errors.push(args) } },
    tools: { register: register(tools) }, skills: { register: register(skills) }, settings,
    credentials: { async resolve() { return { value: '' } } },
    systemPrompt: {
      section(spec) { prompts.set(spec.name, spec); return () => prompts.delete(spec.name) },
      context(spec) { prompts.set(spec.name, spec); return () => prompts.delete(spec.name) },
    },
    get(name) { return this[name] },
    inject(deps, callback) {
      injected.push([...deps])
      if (deps.every(name => this[name])) callback(this)
    },
    effect(fn) { const dispose = fn(); if (typeof dispose === 'function') effects.push(dispose); return dispose },
    on(event, fn) {
      let list = listeners.get(event)
      if (!list) listeners.set(event, list = new Set())
      list.add(fn)
      return () => list.delete(fn)
    },
    emit(event, ...args) { for (const fn of listeners.get(event) ?? []) fn(...args) },
  }
  t.after(async () => {
    for (const dispose of effects.reverse()) dispose()
    listeners.clear()
    await pause()
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  })
  return { ctx, tools, skills, prompts, injected, errors }
}

test('current Schema wraps defaults and partial profile starts the shipped Host bundle', async t => {
  // Existing profiles lack the new target-list fields. They arrive as references
  // containing empty defaults, which used to throw value.split on activation.
  const config = currentConfig({
    installAgentPreset: false, alarmPushEnabled: false, apiUrl: 'http://10.0.0.1:8890/',
    lang: 'en', toolCallTimeoutMs: 45000, tokenCredentialRef: 'CUSTOM_TOKEN',
    groupOpsInPreset: false, groupOpsPublic: true, groupKbInPreset: false,
    thinkingLanguage: 'en', replyLanguage: 'en',
  })
  assert.ok(isVolatile(config.groupOpsPresets))
  assert.equal(config.groupOpsPresets.get(), '')
  assert.ok(isVolatile(config.installAgentPreset))
  const mounted = context(t)
  assert.doesNotThrow(() => currentHost.apply(mounted.ctx, config))
  assert.equal(store().apiUrl, 'http://10.0.0.1:8890')
  assert.equal(store().lang, 'en')
  assert.equal(store().toolCallTimeoutMs, 45000)
  assert.equal(store().groups.ops.inPreset, false)
  assert.equal(store().groups.ops.public, true)
  assert.equal(store().groupKbInPreset, false)
  assert.equal(mounted.injected.some(deps => deps.length === 1 && deps[0] === 'agentPresets'), false,
    'false reference must not run the installer')
  assert.equal(mounted.tools.size, 15)
  await pause()
  assert.ok(mounted.skills.has('netx-ops'))
  assert.equal(globalThis[Symbol.for('dsh-netxops.alarm-push-status')].status.enabled, false)
  assert.equal(globalThis[Symbol.for('dsh-netxops.alarm-push-status')].status.phase, 'disabled')
  assert.equal(mounted.errors.length, 0)
})

test('Loader updates read retained references and immediately revoke and republish tools and skills', async t => {
  const config = currentConfig({ installAgentPreset: false, alarmPushEnabled: false,
    groupOpsPublic: true, groupOpsPresets: 'standard,review', groupKbPresets: 'review' })
  const mounted = context(t)
  currentHost.apply(mounted.ctx, config)
  await pause()
  assert.equal(mounted.tools.size, 15)
  assert.ok(mounted.skills.has('netx-ops'))
  assert.deepEqual(store().groups.ops.presets, ['standard', 'review'])
  assert.equal(store().groupKbPresets, 'review')
  const original = config.toolsEnabled
  updateVolatile(original, createVolatile(false))
  updateVolatile(config.groupOpsPresets, createVolatile(''))
  mounted.ctx.emit('loader/volatile-update', [['toolsEnabled'], ['groupOpsPresets']])
  assert.equal(config.toolsEnabled, original, 'Loader retains identity')
  assert.equal(store().toolsEnabled, false)
  assert.equal(mounted.tools.size, 0, 'revocation is synchronous')
  await pause()
  assert.equal(mounted.skills.size, 0)
  assert.deepEqual(store().groups.ops.presets ?? [], [])
  updateVolatile(original, createVolatile(true))
  updateVolatile(config.groupOpsPublic, createVolatile(false))
  updateVolatile(config.groupOpsPresets, createVolatile('standard'))
  updateVolatile(config.apiUrl, createVolatile('http://10.0.0.2:8890'))
  mounted.ctx.emit('loader/volatile-update', [['toolsEnabled'], ['groupOpsPublic'], ['groupOpsPresets'], ['apiUrl']])
  assert.equal(store().toolsEnabled, true)
  assert.equal(store().apiUrl, 'http://10.0.0.2:8890')
  assert.equal(store().groups.ops.public, false)
  assert.deepEqual(store().groups.ops.presets, ['standard'])
  await pause()
  assert.equal(mounted.tools.size, 0)
  assert.equal(mounted.skills.size, 0)
  assert.equal(mounted.errors.length, 0)
})

test('legacy scalar settings remain valid and a reference-returning settings scope is read on every change', async t => {
  let current = host.Config({ installAgentPreset: false, alarmPushEnabled: false, groupOpsPublic: true })
  let changed
  const mounted = context(t, {
    installSection(ctx, ns, schema, base, hooks) {
      assert.equal(typeof base.installAgentPreset, 'boolean')
      hooks.setSource(() => current)
      changed = hooks.onChange
      changed()
    },
  })
  host.apply(mounted.ctx, current)
  assert.equal(mounted.tools.size, 15)
  current = currentConfig({ installAgentPreset: false, alarmPushEnabled: false, toolsEnabled: false, groupOpsPublic: true })
  changed()
  assert.equal(store().toolsEnabled, false)
  assert.equal(mounted.tools.size, 0)
  await pause()
  assert.equal(mounted.skills.size, 0)
  assert.equal(mounted.errors.length, 0)
})

test('policy helpers read official references and malformed preset lists cannot crash or select a target', () => {
  const config = currentConfig({ groupOpsInPreset: false, groupOpsPublic: true,
    groupOpsPresets: 'standard，review standard', groupKbPublic: false, groupKbInPreset: false })
  const groups = capabilityGroupsFromSettings(config)
  assert.equal(groups.ops.inPreset, false)
  assert.equal(groups.ops.public, true)
  assert.deepEqual(groups.ops.presets, ['standard', 'review'])
  assert.equal(kbEnabledForPlane(config, 'preset'), false)
  assert.equal(kbEnabledForPlane(config, 'host'), false)
  assert.equal(host.resolveTokenCredentialRef(createVolatile('CUSTOM_TOKEN')), 'CUSTOM_TOKEN')
  const merged = host.mergeConfigSkippingNullish(config, {
    groupOpsPublic: createVolatile(false), apiUrl: createVolatile(null), groupOpsPresets: createVolatile(''),
  })
  assert.equal(merged.groupOpsPublic, false)
  assert.equal(merged.groupOpsPresets, '')
  assert.equal(merged.apiUrl, 'http://127.0.0.1:8890')
  for (const value of [null, undefined, 0, true, {}, [], { get: () => 'standard' }]) {
    assert.deepEqual(parsePresetIds(value), [])
  }
  assert.deepEqual(parsePresetIds(createVolatile('standard,review standard')), ['standard', 'review'])
})

test('real Cordis activates the current-schema bundle and delivers the owning fiber update', async t => {
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'netxops-volatile-cordis-'))
  const root = new Context(), owners = [], tools = new Map(), skills = new Map()
  class Tools extends Service {
    constructor(ctx) { super(ctx, 'tools') }
    register(entry) {
      assert.equal(tools.has(entry.name), false)
      tools.set(entry.name, entry)
      return () => tools.delete(entry.name)
    }
  }
  class Skills extends Service {
    constructor(ctx) { super(ctx, 'skills') }
    register(entry) {
      assert.equal(skills.has(entry.name), false)
      skills.set(entry.name, entry)
      return () => skills.delete(entry.name)
    }
  }
  t.after(async () => {
    for (const owner of owners.reverse()) await owner.dispose()
    await pause()
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  })
  owners.push(await root.plugin(Tools))
  owners.push(await root.plugin(Skills))
  const owner = await root.plugin({ ...currentHost, name: 'volatile-startup-integration' }, {
    installAgentPreset: false, alarmPushEnabled: false, groupOpsPublic: true,
  })
  owners.push(owner)
  // FiberState is a const enum and has no JS export in this installed Cordis.
  assert.equal(owner.state, 2 /* ACTIVE */)
  assert.ok(isVolatile(owner.config.groupOpsPresets))
  assert.equal(tools.size, 15)
  await pause()
  assert.ok(skills.has('netx-ops'))
  updateVolatile(owner.config.toolsEnabled, createVolatile(false))
  const self = Object.create(owner.ctx)
  self[Context.filter] = ctx => ctx.fiber === owner
  owner.ctx.emit(self, 'loader/volatile-update', [['toolsEnabled']])
  assert.equal(owner.state, 2 /* ACTIVE */, 'volatile edit keeps the active fiber')
  assert.equal(store().toolsEnabled, false)
  assert.equal(tools.size, 0)
  await pause()
  assert.equal(skills.size, 0)
  const unloadErrors = [], previousError = console.error
  try {
    console.error = (...args) => { unloadErrors.push(args) }
    await owner.dispose()
    owners.pop()
    await pause()
  } finally { console.error = previousError }
  assert.equal(tools.size, 0)
  assert.equal(skills.size, 0)
  assert.deepEqual(unloadErrors, [], 'unload must not remount on an inactive context')
})
