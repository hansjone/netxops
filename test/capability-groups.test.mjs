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
})

test('one group one skill dir; ops owns NMS + managed CLI; topology owns canvas; bizMonitor owns cutover read', () => {
  assert.deepEqual(SKILL_DIR_BY_GROUP, {
    ops: 'ops',
    topology: 'topology',
    bizMonitor: 'biz-monitor',
  })
  assert.ok(TOOLS_BY_GROUP.ops.includes('netx__findTopologyPaths'))
  assert.ok(TOOLS_BY_GROUP.ops.includes('netx__execManagedNe'))
  assert.ok(TOOLS_BY_GROUP.ops.includes('netx__queryNmsAlarms'))
  assert.ok(TOOLS_BY_GROUP.topology.includes('netx__getTopologyTree'))
  assert.ok(TOOLS_BY_GROUP.topology.includes('netx__layoutTopologyView'))
  assert.ok(TOOLS_BY_GROUP.topology.includes('netx__suggestSinkHubs'))
  assert.ok(TOOLS_BY_GROUP.topology.includes('netx__sinkTopologyDualUnits'))
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
  assert.ok(toolNamesForGroups(['topology']).has('netx__sinkTopologyDualUnits'))
  assert.equal(toolNamesForGroups(['topology']).has('netx__queryNmsAlarms'), false)
  assert.equal(toolNamesForGroups(['topology']).has('netx__getBizMonitorContext'), false)
})

test('legacy groupNms/common/managedNe map to ops; legacy layout flags OR into topology', () => {
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

test('groupsForced ignores settings for per-export mounts', () => {
  assert.deepEqual(groupsForced(['ops']), ['ops'])
  assert.deepEqual(groupsForced(['ops', 'topology']), ['ops', 'topology'])
  assert.deepEqual(groupsForced(['bizMonitor']), ['bizMonitor'])
})
