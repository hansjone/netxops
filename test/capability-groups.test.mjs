/**
 * Capability-group defaults and plane filters.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  capabilityGroupsFromSettings,
  DEFAULT_CAPABILITY_GROUPS,
  groupsForPlane,
  groupsForced,
  kbEnabledForPlane,
  SKILL_DIR_BY_GROUP,
  toolNamesForGroups,
  TOOLS_BY_GROUP,
} from '../src/netx/capability-groups.ts'

test('defaults: ops + bizMonitor in preset; topology and public off', () => {
  assert.deepEqual(DEFAULT_CAPABILITY_GROUPS, {
    ops: { inPreset: true, public: false },
    topology: { inPreset: false, public: false },
    bizMonitor: { inPreset: true, public: false },
  })
  assert.deepEqual(groupsForPlane(undefined, 'preset'), ['ops', 'bizMonitor'])
  assert.deepEqual(groupsForPlane(undefined, 'public'), [])
  assert.deepEqual(groupsForPlane(undefined, 'host'), [])
})

test('host plane equals public only (not inPreset union)', () => {
  const groups = capabilityGroupsFromSettings({
    groupOpsInPreset: false,
    groupOpsPublic: true,
    groupBizMonitorInPreset: false,
    groupTopologyInPreset: true,
  })
  assert.deepEqual(groupsForPlane(groups, 'preset'), ['topology'])
  assert.deepEqual(groupsForPlane(groups, 'public'), ['ops'])
  assert.deepEqual(groupsForPlane(groups, 'host'), ['ops'])
})

test('unchecking public revokes host even when inPreset stays on', () => {
  const groups = capabilityGroupsFromSettings({
    groupOpsInPreset: true,
    groupOpsPublic: false,
    groupBizMonitorInPreset: true,
    groupBizMonitorPublic: false,
  })
  assert.deepEqual(groupsForPlane(groups, 'preset'), ['ops', 'bizMonitor'])
  assert.deepEqual(groupsForPlane(groups, 'host'), [])
  assert.deepEqual(groupsForPlane(groups, 'public'), [])
})

test('preset and host planes are symmetric; only defaults differ', () => {
  const both = capabilityGroupsFromSettings({
    groupOpsInPreset: true,
    groupOpsPublic: true,
    groupTopologyInPreset: false,
    groupTopologyPublic: false,
    groupBizMonitorInPreset: false,
    groupBizMonitorPublic: true,
  })
  assert.deepEqual(groupsForPlane(both, 'preset'), ['ops'])
  assert.deepEqual(groupsForPlane(both, 'host'), ['ops', 'bizMonitor'])

  const neither = capabilityGroupsFromSettings({
    groupOpsInPreset: false,
    groupOpsPublic: false,
    groupBizMonitorInPreset: false,
    groupBizMonitorPublic: false,
  })
  assert.deepEqual(groupsForPlane(neither, 'preset'), [])
  assert.deepEqual(groupsForPlane(neither, 'host'), [])
})

test('null boolean flags do not resurrect defaults incorrectly', () => {
  // Settings projection may emit null for volatile booleans.
  const groups = capabilityGroupsFromSettings({
    groupOpsInPreset: /** @type {any} */ (null),
    groupOpsPublic: /** @type {any} */ (null),
    groupBizMonitorInPreset: /** @type {any} */ (null),
    groupBizMonitorPublic: /** @type {any} */ (null),
  })
  // null is not a boolean → fall back to defaults (ops+bizMonitor inPreset, public off)
  assert.deepEqual(groupsForPlane(groups, 'preset'), ['ops', 'bizMonitor'])
  assert.deepEqual(groupsForPlane(groups, 'host'), [])
})

test('kbEnabledForPlane mirrors inPreset/public symmetry', () => {
  assert.equal(kbEnabledForPlane({ groupKbInPreset: true, groupKbPublic: false }, 'preset'), true)
  assert.equal(kbEnabledForPlane({ groupKbInPreset: true, groupKbPublic: false }, 'host'), false)
  assert.equal(kbEnabledForPlane({ groupKbInPreset: false, groupKbPublic: true }, 'preset'), false)
  assert.equal(kbEnabledForPlane({ groupKbInPreset: false, groupKbPublic: true }, 'host'), true)
  assert.equal(kbEnabledForPlane({}, 'preset'), true)
  assert.equal(kbEnabledForPlane({}, 'host'), false)
})

test('one group one skill dir; ops owns NMS + managed CLI; topology owns canvas; bizMonitor owns cutover read', () => {
  assert.deepEqual(SKILL_DIR_BY_GROUP, {
    ops: 'ops',
    topology: 'topology',
    bizMonitor: 'biz-monitor',
  })
  assert.ok(TOOLS_BY_GROUP.ops.includes('netx__findTopologyPaths'))
  assert.ok(TOOLS_BY_GROUP.ops.includes('netx__execManagedNe'))
  assert.ok(TOOLS_BY_GROUP.ops.includes('netx__getNeExecJob'))
  assert.ok(TOOLS_BY_GROUP.ops.includes('netx__queryNmsAlarms'))
  assert.ok(TOOLS_BY_GROUP.topology.includes('netx__getTopologyTree'))
  assert.ok(TOOLS_BY_GROUP.topology.includes('netx__layoutTopologyView'))
  assert.ok(TOOLS_BY_GROUP.topology.includes('netx__suggestSinkHubs'))
  assert.equal(TOOLS_BY_GROUP.topology.includes('netx__sinkTopologyDualUnits'), false)
  assert.ok(TOOLS_BY_GROUP.bizMonitor.includes('netx__getBizMonitorContext'))
  assert.ok(TOOLS_BY_GROUP.bizMonitor.includes('netx__listBizMonitors'))
  assert.ok(TOOLS_BY_GROUP.bizMonitor.includes('netx__listBizMonitorBatches'))
  assert.ok(TOOLS_BY_GROUP.bizMonitor.includes('netx__getBizCollectCommandRaw'))
})

test('capabilityGroupsFromSettings honors explicit false for inPreset defaults', () => {
  const groups = capabilityGroupsFromSettings({
    groupOpsInPreset: false,
    groupBizMonitorInPreset: false,
    groupTopologyInPreset: true,
    groupTopologyPublic: true,
  })
  assert.deepEqual(groupsForPlane(groups, 'preset'), ['topology'])
  assert.deepEqual(groupsForPlane(groups, 'public'), ['topology'])
  assert.ok(toolNamesForGroups(['topology']).has('netx__layoutTopologyView'))
  assert.equal(toolNamesForGroups(['topology']).has('netx__sinkTopologyDualUnits'), false)
  assert.equal(toolNamesForGroups(['topology']).has('netx__queryNmsAlarms'), false)
  assert.equal(toolNamesForGroups(['topology']).has('netx__getBizMonitorContext'), false)
})

test('legacy groupNms/common/managedNe map to ops; absent topology flags use legacy layout', () => {
  const groups = capabilityGroupsFromSettings({
    groupNmsInPreset: false,
    groupCommonInPreset: false,
    groupManagedNePublic: true,
    groupTopologyLayoutInPreset: true,
  })
  assert.equal(groups.ops.inPreset, false)
  assert.equal(groups.ops.public, true)
  assert.equal(groups.topology.inPreset, true)
  assert.equal(groups.bizMonitor.inPreset, true)
})

test('legacy any-true turns ops inPreset on', () => {
  const groups = capabilityGroupsFromSettings({
    groupNmsInPreset: false,
    groupCommonInPreset: true,
  })
  assert.equal(groups.ops.inPreset, true)
})

test('groupsForced normalizes group allow-lists independently from publication', () => {
  assert.deepEqual(groupsForced(['ops']), ['ops'])
  assert.deepEqual(groupsForced(['ops', 'topology']), ['ops', 'topology'])
  assert.deepEqual(groupsForced(['bizMonitor']), ['bizMonitor'])
})
