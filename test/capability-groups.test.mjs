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

test('defaults: ops in preset; topology and public off', () => {
  assert.deepEqual(DEFAULT_CAPABILITY_GROUPS, {
    ops: { inPreset: true, public: false },
    topology: { inPreset: false, public: false },
  })
  assert.deepEqual(groupsForPlane(undefined, 'preset'), ['ops'])
  assert.deepEqual(groupsForPlane(undefined, 'public'), [])
})

test('one group one skill dir; ops owns NMS + managed CLI; topology owns canvas', () => {
  assert.deepEqual(SKILL_DIR_BY_GROUP, {
    ops: 'ops',
    topology: 'topology',
  })
  assert.ok(TOOLS_BY_GROUP.ops.includes('netx__findTopologyPaths'))
  assert.ok(TOOLS_BY_GROUP.ops.includes('netx__execManagedNe'))
  assert.ok(TOOLS_BY_GROUP.ops.includes('netx__queryNmsAlarms'))
  assert.ok(TOOLS_BY_GROUP.topology.includes('netx__getTopologyTree'))
  assert.ok(TOOLS_BY_GROUP.topology.includes('netx__layoutTopologyView'))
  assert.ok(TOOLS_BY_GROUP.topology.includes('netx__suggestSinkHubs'))
  assert.ok(TOOLS_BY_GROUP.topology.includes('netx__sinkTopologyDualUnits'))
})

test('capabilityGroupsFromSettings honors explicit false for inPreset defaults', () => {
  const groups = capabilityGroupsFromSettings({
    groupOpsInPreset: false,
    groupTopologyInPreset: true,
    groupTopologyPublic: true,
  })
  assert.deepEqual(groupsForPlane(groups, 'preset'), ['topology'])
  assert.deepEqual(groupsForPlane(groups, 'public'), ['topology'])
  assert.ok(toolNamesForGroups(['topology']).has('netx__layoutTopologyView'))
  assert.ok(toolNamesForGroups(['topology']).has('netx__sinkTopologyDualUnits'))
  assert.equal(toolNamesForGroups(['topology']).has('netx__queryNmsAlarms'), false)
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
})
