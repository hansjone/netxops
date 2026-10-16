/**
 * Shared agent-plane mount: tools + skills for one or more capability groups.
 *
 * Tools come from the cached netx `/mcp` catalog. Plugin switches only control
 * model visibility — not security.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'
import {
  groupsForPreset,
  kbEnabledForPlane,
  type NetxCapabilityGroupId,
} from './capability-groups.ts'
import { disabledPublicNames } from './mcp-catalog.ts'
import { getMcpCatalogTools, watchMcpCatalog } from './mcp-store.ts'
import { registerGroupSkills, type DisabledToolsByGroup } from './group-skills.ts'
import { registerKbContextSkill } from './kb-context-skill.ts'
import { registerKbLocalTools } from './kb-local-tools.ts'
import { registerKbPackSkills } from './kb-pack-skills.ts'
import { getKbContext, watchKbContext } from './kb-runtime.ts'
import {
  getNetxConnection,
  requireNetxConnection,
  watchNetxConnection,
} from './runtime.ts'
import { getToolMountId, publishToolMountStatus, removeToolMountStatus } from './tool-mount-status.ts'
import { registerNetxTools } from './tools.ts'

function packageVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as { version?: string }
    return typeof pkg.version === 'string' ? pkg.version : '0'
  } catch {
    return '0'
  }
}

export interface GroupToolsPluginOptions {
  /** Cordis plugin name. */
  name: string
  /**
   * `settings` — honor inPreset/public from connection (Ops aggregate mount).
   * `forced` — legacy export label; only filters groups and obeys the publication policy.
   */
  mode: 'settings' | 'forced'
  /** Group allow-list; omit in settings mode to use all groups. */
  only?: readonly NetxCapabilityGroupId[]
  /** Explicit target for live session mounts; otherwise resolve the calling preset. */
  presetId?: string
}

function disabledByGroupFor(
  groupIds: readonly NetxCapabilityGroupId[],
  connection: ReturnType<typeof requireNetxConnection>,
): DisabledToolsByGroup {
  const catalog = getMcpCatalogTools()
  const out: DisabledToolsByGroup = {}
  for (const groupId of groupIds) {
    const names = disabledPublicNames(
      catalog,
      [groupId],
      connection.disabledTools,
      connection.readOnlyOnly,
    )
    if (names.length > 0) out[groupId] = names
  }
  return out
}

/**
 * Apply a group-scoped tools/skills plugin on the calling (usually preset) context.
 */
export function applyGroupToolsPlugin(ctx: Context, options: GroupToolsPluginOptions): void {
  let unregisterTools: (() => void) | undefined
  let unregisterKbLocal: (() => void) | undefined
  let unregisterSkills: (() => void) | undefined
  let skillGeneration = 0
  const presetId = (): string => {
    if (options.presetId) return options.presetId
    const registry = ctx.get('agentPresets') as { composedPreset?: (ctx: Context) => string | undefined } | undefined
    return registry?.composedPreset?.(ctx) ?? 'netxops'
  }
  const mountId = getToolMountId(ctx, options.name)

  const resolveGroups = (): NetxCapabilityGroupId[] => {
    const connection = requireNetxConnection()
    return groupsForPreset(connection, presetId(), options.only)
  }

  const remountTools = (): void => {
    unregisterTools?.()
    unregisterTools = undefined
    const connection = requireNetxConnection()
    const enabled = resolveGroups()
    try {
      unregisterTools = registerNetxTools(ctx, connection, {
        plane: 'preset',
        forceGroups: enabled,
        source: options.name,
        presetId: presetId(),
      })
      ctx.logger.info(
        '%s: groups=[%s] → %s tokenConfigured=%s live=%s catalog=%s',
        options.name,
        enabled.join(',') || '(none)',
        connection.apiUrl,
        connection.token.trim().length > 0,
        getNetxConnection() !== undefined,
        getMcpCatalogTools().length,
      )
    } catch (error) {
      publishToolMountStatus({
        id: mountId,
        version: packageVersion(),
        plane: 'preset',
        groups: [...enabled],
        names: [],
        count: 0,
        at: new Date().toISOString(),
        error: String(error),
        source: options.name,
      })
      ctx.logger.error('%s: registerNetxTools failed: %s', options.name, error)
    }
  }

  const remountKbLocal = (): void => {
    unregisterKbLocal?.()
    unregisterKbLocal = undefined
    const connection = requireNetxConnection()
    if (options.only || !kbEnabledForPlane(connection, 'preset', presetId())) return
    unregisterKbLocal = registerKbLocalTools(ctx, getKbContext(), { plane: 'preset', source: `${options.name}:kb-local` })
  }

  const stopToolWatch = watchNetxConnection(() => {
    remountTools()
    remountKbLocal()
  })
  const stopCatalogWatch = watchMcpCatalog(() => {
    remountTools()
  })
  const stopKbToolWatch = watchKbContext(() => { remountKbLocal() })
  remountTools()
  remountKbLocal()

  let pollTicks = 0
  const pollTimer = setInterval(() => {
    pollTicks += 1
    if (getNetxConnection() !== undefined) {
      remountTools()
      remountKbLocal()
      clearInterval(pollTimer)
      return
    }
    if (pollTicks >= 40) clearInterval(pollTimer)
  }, 500)

  ctx.inject(['skills'], (skillsCtx) => {
    let skillAbort = new AbortController()
    let packAbort = new AbortController()
    let unregisterKbSkill: (() => void) | undefined
    let unregisterKbPack: (() => void) | undefined
    let packGeneration = 0
    const remountSkills = (): void => {
      const gen = ++skillGeneration
      skillAbort.abort()
      skillAbort = new AbortController()
      unregisterSkills?.()
      unregisterSkills = undefined
      const connection = requireNetxConnection()
      const enabled = resolveGroups()
      void registerGroupSkills(skillsCtx, enabled, options.name, {
        signal: skillAbort.signal,
        disabledByGroup: disabledByGroupFor(enabled, connection),
        lang: connection.lang,
      }).then((dispose) => {
        if (gen !== skillGeneration) {
          dispose()
          return
        }
        unregisterSkills = dispose
      }).catch((error) => {
        skillsCtx.logger.warn('%s: skill register failed: %s', options.name, error)
      })
    }
    const remountKbSkill = (): void => {
      unregisterKbSkill?.()
      unregisterKbSkill = undefined
      const connection = requireNetxConnection()
      if (options.only || !kbEnabledForPlane(connection, 'preset', presetId())) return
      unregisterKbSkill = registerKbContextSkill(skillsCtx, getKbContext())
    }
    const remountKbPack = (): void => {
      const gen = ++packGeneration
      packAbort.abort()
      packAbort = new AbortController()
      unregisterKbPack?.()
      unregisterKbPack = undefined
      const connection = requireNetxConnection()
      const enabled = !options.only && kbEnabledForPlane(connection, 'preset', presetId())
      void registerKbPackSkills(skillsCtx, getKbContext(), {
        enabled,
        providerLabel: `${options.name}-kb-pack`,
        signal: packAbort.signal,
      }).then((dispose) => {
        if (gen !== packGeneration) {
          dispose()
          return
        }
        unregisterKbPack = dispose
      }).catch((error) => {
        skillsCtx.logger.warn('%s: kb pack skill register failed: %s', options.name, error)
      })
    }

    const stopSkillWatch = watchNetxConnection(() => {
      remountSkills()
      remountKbSkill()
      remountKbPack()
    })
    const stopSkillCatalogWatch = watchMcpCatalog(() => { remountSkills() })
    const stopKbWatch = watchKbContext(() => {
      remountKbSkill()
      remountKbPack()
    })
    remountSkills()
    remountKbSkill()
    remountKbPack()
    skillsCtx.effect(() => () => {
      skillGeneration += 1
      packGeneration += 1
      skillAbort.abort()
      packAbort.abort()
      stopSkillWatch()
      stopSkillCatalogWatch()
      stopKbWatch()
      unregisterSkills?.()
      unregisterSkills = undefined
      unregisterKbSkill?.()
      unregisterKbSkill = undefined
      unregisterKbPack?.()
      unregisterKbPack = undefined
    }, `${options.name}: dispose skills`)
  })

  ctx.effect(() => () => {
    clearInterval(pollTimer)
    stopToolWatch()
    stopCatalogWatch()
    stopKbToolWatch()
    unregisterTools?.()
    unregisterTools = undefined
    unregisterKbLocal?.()
    unregisterKbLocal = undefined
    removeToolMountStatus(mountId)
  }, `${options.name}: dispose tools`)
}
