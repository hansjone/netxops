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

test('defaults: nms + common in preset; topology and public off', () => {
  assert.deepEqual(DEFAULT_CAPABILITY_GROUPS, {
    nms: { inPreset: true, public: false },
    common: { inPreset: true, public: false },
    topology: { inPreset: false, public: false },
  })
  assert.deepEqual(groupsForPlane(undefined, 'preset'), ['nms', 'common'])
  assert.deepEqual(groupsForPlane(undefined, 'public'), [])
})

test('one group one skill dir; topology owns canvas + layout tools', () => {
  assert.deepEqual(SKILL_DIR_BY_GROUP, {
    nms: 'nms',
    common: 'common',
    topology: 'topology',
  })
  assert.ok(TOOLS_BY_GROUP.common.includes('netx__findTopologyPaths'))
  assert.ok(TOOLS_BY_GROUP.topology.includes('netx__getTopologyTree'))
  assert.ok(TOOLS_BY_GROUP.topology.includes('netx__layoutTopologyView'))
  assert.ok(TOOLS_BY_GROUP.topology.includes('netx__suggestSinkHubs'))
  assert.ok(TOOLS_BY_GROUP.topology.includes('netx__sinkTopologyDualUnits'))
  assert.ok(TOOLS_BY_GROUP.nms.includes('netx__queryNmsAlarms'))
})

test('capabilityGroupsFromSettings honors explicit false for inPreset defaults', () => {
  const groups = capabilityGroupsFromSettings({
    groupNmsInPreset: false,
    groupCommonInPreset: false,
    groupTopologyInPreset: true,
    groupTopologyPublic: true,
  })
  assert.deepEqual(groupsForPlane(groups, 'preset'), ['topology'])
  assert.deepEqual(groupsForPlane(groups, 'public'), ['topology'])
  assert.ok(toolNamesForGroups(['topology']).has('netx__layoutTopologyView'))
  assert.ok(toolNamesForGroups(['topology']).has('netx__sinkTopologyDualUnits'))
  assert.equal(toolNamesForGroups(['topology']).has('netx__queryNmsAlarms'), false)
})

test('legacy groupManagedNe* maps to common; legacy layout flags OR into topology', () => {
  const groups = capabilityGroupsFromSettings({
    groupManagedNeInPreset: false,
    groupManagedNePublic: true,
    groupTopologyLayoutInPreset: true,
  })
  assert.equal(groups.common.inPreset, false)
  assert.equal(groups.common.public, true)
  assert.equal(groups.topology.inPreset, true)
})

test('groupsForced ignores settings for per-export mounts', () => {
  assert.deepEqual(groupsForced(['common']), ['common'])
  assert.deepEqual(groupsForced(['nms', 'topology']), ['nms', 'topology'])
})
