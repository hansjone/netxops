/**
 * Filter remote MCP tools for DSH registration.
 *
 * Security note: these filters only hide tools from the model. Real authz is
 * enforced by netx `/mcp` (token RBAC + CLI guards).
 */

import type { NetxCapabilityGroupId, NetxCapabilityGroups } from './capability-groups.ts'
import { groupsForPlane, groupsForPreset } from './capability-groups.ts'
import type { NetxMcpToolDescriptor } from './mcp-types.ts'
import { publicToolName } from './mcp-types.ts'

export interface ToolFilterPolicy {
  toolsEnabled?: boolean
  groups?: NetxCapabilityGroups
  /** Server tool names the operator turned off (opt-out). */
  disabledTools?: readonly string[]
  /** When true, drop tools whose readOnlyHint is not true. */
  readOnlyOnly?: boolean
}

export interface ResolveEnabledToolsOptions extends ToolFilterPolicy {
  plane: 'preset' | 'public' | 'host'
  forceGroups?: readonly NetxCapabilityGroupId[]
  only?: readonly NetxCapabilityGroupId[]
  /** When plane is preset, which preset id is mounting. */
  presetId?: string
}

function disabledSet(disabledTools: readonly string[] | undefined): Set<string> {
  const out = new Set<string>()
  for (const name of disabledTools ?? []) {
    const trimmed = typeof name === 'string' ? name.trim() : ''
    if (trimmed) out.add(trimmed)
  }
  return out
}

/**
 * Parse settings `disabledTools` (JSON array string or comma list) into server names.
 */
export function parseDisabledTools(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(s => s.trim()))]
  }
  if (typeof value !== 'string') return []
  const trimmed = value.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return [...new Set(parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(s => s.trim()))]
      }
    } catch {
      // fall through to CSV
    }
  }
  return [...new Set(trimmed.split(/[\s,，]+/).filter(Boolean))]
}

export function serializeDisabledTools(names: readonly string[]): string {
  return JSON.stringify([...new Set(names.map(n => n.trim()).filter(Boolean))].sort())
}

/**
 * Apply group + disabledTools + readOnlyOnly on top of a catalog snapshot.
 * Tools without a known `_meta.netx.group` are skipped.
 */
export function filterCatalogTools(
  catalog: readonly NetxMcpToolDescriptor[],
  enabledGroups: readonly NetxCapabilityGroupId[],
  policy: Pick<ToolFilterPolicy, 'disabledTools' | 'readOnlyOnly'>,
): NetxMcpToolDescriptor[] {
  const allowGroups = new Set(enabledGroups)
  const disabled = disabledSet(policy.disabledTools)
  const readOnlyOnly = policy.readOnlyOnly === true
  const out: NetxMcpToolDescriptor[] = []
  for (const tool of catalog) {
    if (!tool.group || !allowGroups.has(tool.group)) continue
    if (disabled.has(tool.name)) continue
    if (readOnlyOnly && tool.readOnlyHint !== true) continue
    out.push(tool)
  }
  return out
}

/** Resolve which tools a mount plane should register from the live catalog. */
export function resolveEnabledTools(
  catalog: readonly NetxMcpToolDescriptor[],
  options: ResolveEnabledToolsOptions,
): NetxMcpToolDescriptor[] {
  if (options.toolsEnabled === false) return []
  const enabledGroups = options.forceGroups
    ?? (options.plane === 'preset'
      ? groupsForPreset(
        { toolsEnabled: options.toolsEnabled, groups: options.groups },
        options.presetId ?? 'netxops',
        options.only,
      )
      : groupsForPlane(options.groups, options.plane, options.only))
  return filterCatalogTools(catalog, enabledGroups, options)
}

/** Disabled server names that fall inside the enabled groups (for skill footnotes). */
export function disabledToolsInGroups(
  catalog: readonly NetxMcpToolDescriptor[],
  enabledGroups: readonly NetxCapabilityGroupId[],
  disabledTools: readonly string[] | undefined,
): string[] {
  const allowGroups = new Set(enabledGroups)
  const disabled = disabledSet(disabledTools)
  const out: string[] = []
  for (const tool of catalog) {
    if (!tool.group || !allowGroups.has(tool.group)) continue
    if (!disabled.has(tool.name)) continue
    out.push(tool.name)
  }
  return out.sort()
}

/** Model-facing names for skill footnotes. */
export function disabledPublicNames(
  catalog: readonly NetxMcpToolDescriptor[],
  enabledGroups: readonly NetxCapabilityGroupId[],
  disabledTools: readonly string[] | undefined,
  readOnlyOnly?: boolean,
): string[] {
  const allowGroups = new Set(enabledGroups)
  const disabled = disabledSet(disabledTools)
  const names: string[] = []
  for (const tool of catalog) {
    if (!tool.group || !allowGroups.has(tool.group)) continue
    const off = disabled.has(tool.name) || (readOnlyOnly === true && tool.readOnlyHint !== true)
    if (off) names.push(publicToolName(tool.name))
  }
  return names.sort()
}
