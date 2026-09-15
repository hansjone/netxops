/**
 * Shared agent-plane mount: tools + skills for one or more capability groups.
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'
import {
  groupsForced,
  groupsForPlane,
  type NetxCapabilityGroupId,
} from './capability-groups.ts'
import { registerGroupSkills } from './group-skills.ts'
import { registerKbContextSkill } from './kb-context-skill.ts'
import { registerKbLocalTools } from './kb-local-tools.ts'
import { registerKbPackSkills } from './kb-pack-skills.ts'
import { getKbContext, watchKbContext } from './kb-runtime.ts'
import { getNetxConnection, watchNetxConnection } from './runtime.ts'
import { registerNetxTools } from './tools.ts'

export interface GroupToolsPluginOptions {
  /** Cordis plugin name. */
  name: string
  /**
   * `settings` — honor inPreset/public from connection (Ops aggregate mount).
   * `forced` — always register `only` groups when connection exists (per-group export).
   */
  mode: 'settings' | 'forced'
  /** Group allow-list; omit in settings mode to use all groups. */
  only?: readonly NetxCapabilityGroupId[]
}

/**
 * Apply a group-scoped tools/skills plugin on the calling (usually preset) context.
 */
export function applyGroupToolsPlugin(ctx: Context, options: GroupToolsPluginOptions): void {
  let unregisterTools: (() => void) | undefined
  let unregisterKbLocal: (() => void) | undefined
  let unregisterSkills: (() => void) | undefined
  let skillGeneration = 0

  const resolveGroups = (): NetxCapabilityGroupId[] => {
    const connection = getNetxConnection()
    if (options.mode === 'forced') {
      return groupsForced(options.only ?? [])
    }
    return groupsForPlane(connection?.groups, 'preset', options.only)
  }

  const remountTools = (): void => {
    unregisterTools?.()
    unregisterTools = undefined
    const connection = getNetxConnection()
    if (connection === undefined) {
      ctx.logger.warn('%s: no connection yet — waiting for host settings bridge', options.name)
      return
    }
    const enabled = resolveGroups()
    if (enabled.length === 0) {
      ctx.logger.info('%s: no groups enabled', options.name)
      return
    }
    unregisterTools = registerNetxTools(ctx, connection, {
      plane: 'preset',
      only: options.mode === 'forced' ? enabled : options.only,
      forceGroups: options.mode === 'forced' ? enabled : undefined,
    })
    ctx.logger.info(
      '%s: groups=[%s] → %s tokenConfigured=%s',
      options.name,
      enabled.join(',') || '(none)',
      connection.apiUrl,
      connection.token.trim().length > 0,
    )
  }

  const remountKbLocal = (): void => {
    unregisterKbLocal?.()
    unregisterKbLocal = undefined
    const connection = getNetxConnection()
    if (connection === undefined) return
    if (connection.groupKbInPreset === false) return
    unregisterKbLocal = registerKbLocalTools(ctx, getKbContext())
  }

  remountTools()
  remountKbLocal()
  const stopToolWatch = watchNetxConnection(() => {
    remountTools()
    remountKbLocal()
  })
  const stopKbToolWatch = watchKbContext(() => { remountKbLocal() })

  ctx.inject(['skills'], (skillsCtx) => {
    let unregisterKbSkill: (() => void) | undefined
    let unregisterKbPack: (() => void) | undefined
    let packGeneration = 0
    const remountSkills = (): void => {
      const gen = ++skillGeneration
      unregisterSkills?.()
      unregisterSkills = undefined
      if (getNetxConnection() === undefined) return
      const enabled = resolveGroups()
      void registerGroupSkills(skillsCtx, enabled, options.name).then((dispose) => {
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
      unregisterKbSkill = registerKbContextSkill(skillsCtx, getKbContext())
    }
    const remountKbPack = (): void => {
      const gen = ++packGeneration
      unregisterKbPack?.()
      unregisterKbPack = undefined
      const connection = getNetxConnection()
      const enabled = connection?.groupKbInPreset !== false
      void registerKbPackSkills(skillsCtx, getKbContext(), {
        enabled,
        providerLabel: `${options.name}-kb-pack`,
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

    remountSkills()
    remountKbSkill()
    remountKbPack()
    const stopSkillWatch = watchNetxConnection(() => {
      remountSkills()
      remountKbPack()
    })
    const stopKbWatch = watchKbContext(() => {
      remountKbSkill()
      remountKbPack()
    })
    skillsCtx.effect(() => () => {
      skillGeneration += 1
      packGeneration += 1
      stopSkillWatch()
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
    stopToolWatch()
    stopKbToolWatch()
    unregisterTools?.()
    unregisterTools = undefined
    unregisterKbLocal?.()
    unregisterKbLocal = undefined
  }, `${options.name}: dispose tools`)
}
