/**
 * Netx Ops capability groups: selective tool/skill exposure.
 *
 * Rule: **one group ↔ one skill** (dirs under `netx/skills/<group>/`).
 *
 * - `ops` → skill `netx-ops` — NMS alarms/inventory/SQL + managed CLI + findTopologyPaths
 * - `topology` → skill `netx-topology` — canvas / fabric / dual_unit / layout
 * - `bizMonitor` → skill `netx-biz-monitor` — cutover / biz_state read + overnight analysis
 */

import { readConfigSnapshot, readConfigValue } from './config-values.ts'

/** Stable group ids used in settings, skill dirs, and registration filters. */
export type NetxCapabilityGroupId = 'ops' | 'topology' | 'bizMonitor'

/** Per-group exposure knobs. */
export interface NetxGroupExposure {
  /** Mount into the Netx Ops agent preset scope. */
  inPreset: boolean
  /** Mount on the host tool/skill layer so other presets can see the group. */
  public: boolean
  /** Additional preset ids selected by the operator. */
  presets?: readonly string[]
}

/** Full capability-group policy published with the connection snapshot. */
export type NetxCapabilityGroups = Record<NetxCapabilityGroupId, NetxGroupExposure>

/** Flat settings fields (Plugins card + schemastery Config). */
export interface NetxCapabilityGroupSettingsFields {
  toolsEnabled?: boolean
  groupOpsPresets?: string
  groupTopologyPresets?: string
  groupBizMonitorPresets?: string
  groupOpsInPreset: boolean
  groupOpsPublic: boolean
  groupTopologyInPreset: boolean
  groupTopologyPublic: boolean
  groupBizMonitorInPreset: boolean
  groupBizMonitorPublic: boolean
}

/**
 * Default: ops + bizMonitor in Ops preset; topology and all public off.
 */
export const DEFAULT_CAPABILITY_GROUPS: NetxCapabilityGroups = Object.freeze({
  ops: Object.freeze({ inPreset: true, public: false }),
  topology: Object.freeze({ inPreset: false, public: false }),
  bizMonitor: Object.freeze({ inPreset: true, public: false }),
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
    'netx__getNeExecJob',
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
  ]),
  bizMonitor: Object.freeze([
    'netx__listBizMonitors',
    'netx__listBizMonitorBatches',
    'netx__getBizMonitorContext',
    'netx__getBizMonitorBoard',
    'netx__listBizMonitorReds',
    'netx__getBizMonitorDiffs',
    'netx__getBizCollectBatch',
    'netx__getBizCollectCommandRaw',
  ]),
})

/** Skill directory name under skills root / `presets/netxops/skills/<group>/`. */
export const SKILL_DIR_BY_GROUP: Readonly<Record<NetxCapabilityGroupId, string>> = Object.freeze({
  ops: 'ops',
  topology: 'topology',
  bizMonitor: 'biz-monitor',
})

export const CAPABILITY_GROUP_IDS: readonly NetxCapabilityGroupId[] = Object.freeze([
  'ops',
  'topology',
  'bizMonitor',
])

/**
 * Build group policy from flat settings / Config fields.
 *
 * Legacy aliases (all map into `ops`):
 * - `groupNms*` / `groupCommon*` / `groupManagedNe*`
 *
 * Legacy `groupTopologyLayout*` applies only when the current flag is absent.
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
  const src = readConfigSnapshot(fields ?? {})

  let opsInPreset = true
  if (typeof src.groupOpsInPreset === 'boolean') {
    opsInPreset = src.groupOpsInPreset
  } else {
    const legacy = [
      src.groupNmsInPreset,
      src.groupCommonInPreset,
      src.groupManagedNeInPreset,
    ].filter((v): v is boolean => typeof v === 'boolean')
    if (legacy.length > 0) {
      // Any explicit true → on; all explicit false → off.
      opsInPreset = legacy.some((v) => v === true)
    }
  }

  let bizMonitorInPreset = true
  if (typeof src.groupBizMonitorInPreset === 'boolean') {
    bizMonitorInPreset = src.groupBizMonitorInPreset
  }

  return {
    ops: {
      inPreset: opsInPreset,
      public: (() => {
        if (typeof src.groupOpsPublic === 'boolean') return src.groupOpsPublic
        const legacy = [
          src.groupNmsPublic,
          src.groupCommonPublic,
          src.groupManagedNePublic,
        ].filter((v): v is boolean => typeof v === 'boolean')
        // No explicit flag → default off (Netx Ops preset only).
        if (legacy.length === 0) return false
        return legacy.some((v) => v === true)
      })(),
      ...(src.groupOpsPresets ? { presets: parsePresetIds(src.groupOpsPresets) } : {}),
    },
    topology: {
      inPreset: typeof src.groupTopologyInPreset === 'boolean'
        ? src.groupTopologyInPreset : src.groupTopologyLayoutInPreset === true,
      public: typeof src.groupTopologyPublic === 'boolean'
        ? src.groupTopologyPublic : src.groupTopologyLayoutPublic === true,
      ...(src.groupTopologyPresets ? { presets: parsePresetIds(src.groupTopologyPresets) } : {}),
    },
    bizMonitor: {
      inPreset: bizMonitorInPreset,
      public: src.groupBizMonitorPublic === true,
      ...(src.groupBizMonitorPresets ? { presets: parsePresetIds(src.groupBizMonitorPresets) } : {}),
    },
  }
}

/**
 * KB exposure mirrors capability groups: preset plane ↔ inPreset, host/public ↔ public.
 * Defaults: inPreset on, public off (same strategy as ops/bizMonitor).
 */
export function kbEnabledForPlane(
  flags: { toolsEnabled?: boolean, groupKbInPreset?: boolean, groupKbPublic?: boolean, groupKbPresets?: string } | undefined,
  plane: 'preset' | 'public' | 'host',
  presetId = 'netxops',
): boolean {
  if (flags) flags = readConfigSnapshot(flags)
  if (flags?.toolsEnabled === false) return false
  if (!flags) return plane === 'preset'
  if (plane === 'preset') {
    return !flags.groupKbPublic && (presetId === 'netxops'
      ? flags.groupKbInPreset !== false
      : parsePresetIds(flags.groupKbPresets ?? '').includes(presetId))
  }
  return flags.groupKbPublic === true
}

/**
 * Groups enabled for one registration plane.
 * - `preset` — `inPreset` (Netx Ops standing mount via `dsh-netxops/tools`)
 * - `public` — `public` only
 * - `host` — same as `public` (Host-global registry for other presets)
 *
 * Host must NOT union `inPreset`: otherwise unchecking「公开」leaves tools on the
 * global registry whenever「预设内」is still on, so revoke never takes effect.
 */
export function groupsForPlane(
  groups: NetxCapabilityGroups | undefined,
  plane: 'preset' | 'public' | 'host',
  only?: readonly NetxCapabilityGroupId[],
): NetxCapabilityGroupId[] {
  const policy = groups ?? DEFAULT_CAPABILITY_GROUPS
  const enabled = CAPABILITY_GROUP_IDS.filter((id) => {
    if (plane === 'preset') return policy[id].inPreset
    // host === public: only explicitly published groups leave the Ops preset.
    return policy[id].public
  })
  if (!only || only.length === 0) return enabled
  const allow = new Set(only)
  return enabled.filter((id) => allow.has(id))
}

/**
 * Normalize a group allow-list; publication policy still controls registration.
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
  const out = new Set<string>()
  for (const id of groupIds) {
    for (const name of TOOLS_BY_GROUP[id] ?? []) out.add(name)
  }
  return out
}

/** Parse the persisted preset-id list. Empty is an explicit empty selection. */
export function parsePresetIds(value: unknown): string[] {
  const current = readConfigValue(value)
  if (typeof current !== 'string') return []
  return [...new Set(current.split(/[\s,，]+/).filter(Boolean))]
}

/** Groups mounted locally in a preset; public groups are inherited from Host. */
export function groupsForPreset(
  connection: { toolsEnabled?: boolean, groups?: NetxCapabilityGroups },
  presetId: string,
  only?: readonly NetxCapabilityGroupId[],
): NetxCapabilityGroupId[] {
  if (connection.toolsEnabled === false) return []
  const policy = connection.groups ?? DEFAULT_CAPABILITY_GROUPS
  return CAPABILITY_GROUP_IDS.filter(id => (!only?.length || only.includes(id))
    && !policy[id].public
    && (presetId === 'netxops' ? policy[id].inPreset : policy[id].presets?.includes(presetId)))
}
