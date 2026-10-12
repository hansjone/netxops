import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { capabilityGroupsFromSettings, groupsForPreset, kbEnabledForPlane } from '../src/netx/capability-groups.ts'
import { applyGroupToolsPlugin } from '../src/netx/group-tools-plugin.ts'
import { registerNetxTools } from '../src/netx/tools.ts'
import { registerKbLocalTools } from '../src/netx/kb-local-tools.ts'
import { registerGroupSkills } from '../src/netx/group-skills.ts'
import { publishNetxConnection } from '../src/netx/runtime.ts'
import { getToolMountStatuses, publishToolMountStatus, resetToolMountStatus } from '../src/netx/tool-mount-status.ts'
import { asToolsMountView } from '../src/client/tools-status-view.ts'

const log = { info() {}, warn() {}, error() {} }
const pause = () => new Promise(resolve => setTimeout(resolve, 40))
function connection(fields = {}) {
  return { apiUrl: 'http://127.0.0.1:8890', token: 'test-token', lang: 'zh', toolCallTimeoutMs: 1000,
    toolsEnabled: fields.toolsEnabled ?? true, groups: capabilityGroupsFromSettings(fields),
    groupKbInPreset: fields.groupKbInPreset ?? true, groupKbPublic: fields.groupKbPublic ?? false,
    groupKbPresets: fields.groupKbPresets ?? '' }
}
function fakeContext(failAt = -1) {
  const tools = new Map(), skills = new Map(), cleanups = []
  let registrations = 0
  const register = map => entry => {
    if (map === tools && ++registrations === failAt) throw new Error('registration refused')
    if (map.has(entry.name)) throw new Error(`duplicate: ${entry.name}`)
    map.set(entry.name, entry)
    return () => { if (map.get(entry.name) === entry) map.delete(entry.name) }
  }
  const ctx = { logger: log, tools: { register: register(tools) }, skills: { register: register(skills) },
    get(name) { return this[name] }, inject(deps, fn) { fn(this) },
    effect(fn) { const cleanup = fn(); if (typeof cleanup === 'function') cleanups.push(cleanup); return cleanup } }
  return { ctx, tools, skills, dispose() { for (const fn of cleanups.reverse()) fn() } }
}
function diagnosticHome(t) {
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'netxops-publication-'))
  t.after(() => { if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous })
}

test('selected presets are isolated and global publication is inherited once', () => {
  const selected = connection({ groupOpsInPreset: false, groupOpsPresets: 'standard,review standard', groupBizMonitorInPreset: false })
  assert.deepEqual(groupsForPreset(selected, 'standard'), ['ops'])
  assert.deepEqual(groupsForPreset(selected, 'review'), ['ops'])
  assert.deepEqual(groupsForPreset(selected, 'netxops'), [])
  assert.deepEqual(groupsForPreset(selected, 'other'), [])
  selected.groups.ops.public = true
  assert.deepEqual(groupsForPreset(selected, 'standard'), [], 'public tools come from Host, with no duplicate local registration')
  assert.equal(kbEnabledForPlane({ groupKbInPreset: true, groupKbPublic: true }, 'preset'), false)
})

test('master switch blocks selected, public, preset and explicit group mounts', async t => {
  diagnosticHome(t)
  const disabled = connection({ toolsEnabled: false, groupOpsPublic: true, groupOpsPresets: 'standard', groupKbPublic: true })
  assert.deepEqual(groupsForPreset(disabled, 'standard'), [])
  assert.equal(kbEnabledForPlane(disabled, 'host'), false)
  const { ctx, tools } = fakeContext()
  const dispose = registerNetxTools(ctx, disabled, { plane: 'host', forceGroups: ['ops'] })
  assert.equal(tools.size, 0)
  dispose()
})

test('failed tool registration rolls back every earlier tool', t => {
  diagnosticHome(t)
  const { ctx, tools } = fakeContext(3)
  assert.throws(() => registerNetxTools(ctx, connection(), { plane: 'preset' }), /registration refused/)
  assert.equal(tools.size, 0)
  assert.ok(getToolMountStatuses().some(row => row.error === 'registration refused'))
  resetToolMountStatus()
})

test('disabled group exports cannot force publication back on', async t => {
  diagnosticHome(t)
  publishNetxConnection(connection({ groupOpsInPreset: false, groupBizMonitorInPreset: false, groupKbInPreset: false }))
  const mount = fakeContext()
  applyGroupToolsPlugin(mount.ctx, { name: 'explicit-ops', mode: 'forced', only: ['ops'] })
  await pause()
  assert.equal(mount.tools.size, 0)
  assert.equal(mount.skills.size, 0)
  mount.dispose()
})

test('turning off a mounted group revokes tools, KB context and pending skill loads', async t => {
  diagnosticHome(t)
  publishNetxConnection(connection({ groupBizMonitorInPreset: false }))
  const mount = fakeContext()
  applyGroupToolsPlugin(mount.ctx, { name: 'lifecycle', mode: 'settings' })
  assert.equal(mount.tools.size, 15)
  assert.equal(mount.skills.has('kb-context'), true)
  publishNetxConnection(connection({ toolsEnabled: false }))
  await pause()
  assert.equal(mount.tools.size, 0)
  assert.equal(mount.skills.size, 0)
  publishNetxConnection(connection({ groupBizMonitorInPreset: false }))
  await pause()
  assert.equal(mount.tools.size, 15)
  assert.equal(mount.skills.has('netx-ops'), true)
  mount.dispose()
  await pause()
  assert.equal(mount.tools.size, 0)
  assert.equal(mount.skills.size, 0)
})

test('aborted skill load contributes nothing after asynchronous reads', async () => {
  const mount = fakeContext()
  const abort = new AbortController()
  const pending = registerGroupSkills(mount.ctx, ['ops', 'topology'], 'aborted', abort.signal)
  abort.abort()
  const dispose = await pending
  assert.equal(mount.skills.size, 0)
  dispose()
})

test('mount inventory survives cross-bundle publishes and reports all scopes', async t => {
  diagnosticHome(t)
  resetToolMountStatus()
  publishToolMountStatus({ id: 'host-test', version: 'test', plane: 'host', source: 'host', groups: [], names: [], count: 0, at: '' })
  const entry = await import('../lib/agent-tools.js')
  publishNetxConnection(connection({ groupBizMonitorInPreset: false, groupKbInPreset: false }))
  const mount = fakeContext()
  entry.apply(mount.ctx)
  const statuses = getToolMountStatuses()
  assert.ok(statuses.some(row => row.id === 'host-test'))
  assert.ok(statuses.some(row => row.count === 15))
  const view = asToolsMountView({ mounts: statuses, connection: { toolsEnabled: true } })
  assert.equal(view.count, 15)
  mount.dispose()
  assert.equal(getToolMountStatuses().some(row => row.count > 0), false)
  resetToolMountStatus()
})

test('write tools serialize while read tools allow concurrency', t => {
  diagnosticHome(t)
  const mount = fakeContext()
  const dispose = registerNetxTools(mount.ctx, connection(), { plane: 'preset', forceGroups: ['ops', 'topology'] })
  assert.equal(mount.tools.get('netx__queryNmsAlarms').isConcurrencySafe({}), true)
  assert.equal(mount.tools.get('netx__execManagedNe').isConcurrencySafe({}), false)
  assert.equal(mount.tools.get('netx__updateTopologyViewPositions').isConcurrencySafe({}), false)
  dispose()
})

test('knowledge-base tools contribute to the mount inventory and disappear on disposal', t => {
  diagnosticHome(t)
  resetToolMountStatus()
  const mount = fakeContext()
  const snapshot = { status: 'configured', realRoot: process.env.DSH_HOME, paths: { local: '_local' } }
  const dispose = registerKbLocalTools(mount.ctx, snapshot, { plane: 'preset', source: 'kb-test' })
  // 2 read (kbSearch / kbRead) + 7 local write/list tools.
  assert.equal(mount.tools.size, 9)
  const statuses = getToolMountStatuses()
  assert.ok(statuses.some(row => row.source === 'kb-test' && row.count === 9 && row.groups.includes('kb')))
  assert.equal(asToolsMountView({ mounts: statuses }).count, 9)
  dispose()
  assert.equal(mount.tools.size, 0)
  assert.equal(getToolMountStatuses().some(row => row.source === 'kb-test'), false)
})
