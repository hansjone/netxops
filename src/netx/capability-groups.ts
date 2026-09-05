/**
 * Netx Ops capability groups: selective tool/skill exposure.
 *
 * Rule: **one group ↔ one skill** (dirs under `netx/skills/<group>/`).
 *
 * - `ops` → skill `netx-ops` — NMS alarms/inventory/SQL + managed CLI + findTopologyPaths
 * - `topology` → skill `netx-topology` — canvas / fabric / dual_unit / layout
 */

/** Stable group ids used in settings, skill dirs, and registration filters. */
export type NetxCapabilityGroupId = 'ops' | 'topology'

/** Per-group exposure knobs. */
export interface NetxGroupExposure {
  /** Mount into the Netx Ops agent preset scope. */
  inPreset: boolean
  /** Mount on the host tool/skill layer so other presets can see the group. */
  public: boolean
}

/** Full capability-group policy published with the connection snapshot. */
export type NetxCapabilityGroups = Record<NetxCapabilityGroupId, NetxGroupExposure>

/** Flat settings fields (Plugins card + schemastery Config). */
export interface NetxCapabilityGroupSettingsFields {
  groupOpsInPreset: boolean
  groupOpsPublic: boolean
  groupTopologyInPreset: boolean
  groupTopologyPublic: boolean
}

/**
 * Default: ops in Ops preset; topology and all public off.
 */
export const DEFAULT_CAPABILITY_GROUPS: NetxCapabilityGroups = Object.freeze({
  ops: Object.freeze({ inPreset: true, public: false }),
  topology: Object.freeze({ inPreset: false, public: false }),
})

/**
 * Model-facing tool names (`netx__*`) owned by each group.
 * NMS tools use generic `Nms` names; HTTP still hits the configured NMS provider adapter.
 */
export const TOOLS_BY_GROUP: Readonly<Record<NetxCapabilityGroupId, readonly string[]>> = Object.freeze({
  ops: Object.freeze([
    'netx__queryNmsAlarms',
    'netx__aggregateNmsAlarms',
    'netx__runNmsDiagnostics',
    'netx__queryNmsNeInventory',
    'netx__getNmsNe',
    'netx__queryNmsAlarmsRaw',
    'netx__aggregateNmsAlarmsRaw',
    'netx__listNmsAlarmFields',
    'netx__sqlQueryNms',
    'netx__listManagedNe',
    'netx__getManagedNe',
    'netx__execManagedNe',
    'netx__listCliTargets',
    'netx__findTopologyPaths',
  ]),
  topology: Object.freeze([
    'netx__getTopologyTree',
    'netx__getTopologyView',
    'netx__createTopologyFolder',
    'netx__addTopologyViewNodes',
    'netx__removeTopologyViewNodes',
    'netx__copyTopologyViewNodes',
    'netx__updateTopologyViewPositions',
    'netx__projectTopologyNeighbors',
    'netx__queryTopologyFabricNodes',
    'netx__classifyTopologyFabricNodes',
    'netx__queryTopologyNeighborhood',
    'netx__queryTopologyEdges',
    'netx__layoutTopologyView',
    'netx__suggestSinkHubs',
    'netx__analyzeTopologyViewLayout',
    'netx__sinkTopologyDualUnits',
  ]),
})

/** Skill directory name under skills root / `presets/netxops/skills/<group>/`. */
export const SKILL_DIR_BY_GROUP: Readonly<Record<NetxCapabilityGroupId, string>> = Object.freeze({
  ops: 'ops',
  topology: 'topology',
})

export const CAPABILITY_GROUP_IDS: readonly NetxCapabilityGroupId[] = Object.freeze([
  'ops',
  'topology',
])

/**
 * Build group policy from flat settings / Config fields.
 *
 * Legacy aliases (all map into `ops`):
 * - `groupNms*` / `groupCommon*` / `groupManagedNe*`
 *
 * Legacy `groupTopologyLayout*` ORs into `topology`.
 */
export function capabilityGroupsFromSettings(
  fields: Partial<NetxCapabilityGroupSettingsFields & {
    groupNmsInPreset?: boolean
    groupNmsPublic?: boolean
    groupCommonInPreset?: boolean
    groupCommonPublic?: boolean
    groupManagedNeInPreset?: boolean
    groupManagedNePublic?: boolean
    groupTopologyLayoutInPreset?: boolean
    groupTopologyLayoutPublic?: boolean
  }> | null | undefined,
): NetxCapabilityGroups {
  const src = fields ?? {}

  let opsInPreset = true
  if (src.groupOpsInPreset !== undefined) {
    opsInPreset = src.groupOpsInPreset !== false
  } else {
    const legacy = [
      src.groupNmsInPreset,
      src.groupCommonInPreset,
      src.groupManagedNeInPreset,
    ].filter((v): v is boolean => v !== undefined)
    if (legacy.length > 0) {
      // Any explicit true → on; all explicit false → off.
      opsInPreset = legacy.some((v) => v === true)
    }
  }

  return {
    ops: {
      inPreset: opsInPreset,
      public: src.groupOpsPublic === true
        || src.groupNmsPublic === true
        || src.groupCommonPublic === true
        || src.groupManagedNePublic === true,
    },
    topology: {
      inPreset: src.groupTopologyInPreset === true
        || src.groupTopologyLayoutInPreset === true,
      public: src.groupTopologyPublic === true
        || src.groupTopologyLayoutPublic === true,
    },
  }
}

/**
 * Groups enabled for one registration plane.
 */
export function groupsForPlane(
  groups: NetxCapabilityGroups | undefined,
  plane: 'preset' | 'public',
  only?: readonly NetxCapabilityGroupId[],
): NetxCapabilityGroupId[] {
  const policy = groups ?? DEFAULT_CAPABILITY_GROUPS
  const enabled = CAPABILITY_GROUP_IDS.filter((id) => (
    plane === 'preset' ? policy[id].inPreset : policy[id].public
  ))
  if (!only || only.length === 0) return enabled
  const allow = new Set(only)
  return enabled.filter((id) => allow.has(id))
}

/**
 * Force-enable the listed groups (for `dsh-netxops/tools-<group>` mounts).
 * Legacy `nms` / `common` aliases resolve to `ops`.
 */
export function groupsForced(
  only: readonly (NetxCapabilityGroupId | 'nms' | 'common')[],
): NetxCapabilityGroupId[] {
  const normalized = only.map((id) => (
    id === 'nms' || id === 'common' ? 'ops' as const : id
  ))
  return CAPABILITY_GROUP_IDS.filter((id) => normalized.includes(id))
}

/**
 * Tool name allow-list for the given groups.
 */
export function toolNamesForGroups(groupIds: readonly NetxCapabilityGroupId[]): Set<string> {
  const names = new Set<string>()
  for (const id of groupIds) {
    for (const tool of TOOLS_BY_GROUP[id]) names.add(tool)
  }
  return names
}
