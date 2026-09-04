/**
 * Agent-plane Netx Ops tools: register `netx__*` into the calling context's
 * tool scope (the Netx Ops preset standing mount), so other presets do not see them.
 *
 * @module dsh-netxops/tools
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'
import { getNetxConnection, watchNetxConnection } from './netx/runtime.ts'
import { registerNetxTools } from './netx/tools.ts'

/** Cordis plugin name. */
export const name = 'netxops-tools'

/** Tool registry must exist in this (preset-scoped) context. */
export const inject = ['tools']

/**
 * Mount netx REST tools for the Netx Ops agent preset only.
 */
export function apply(ctx: Context): void {
  let unregister: (() => void) | undefined

  const remount = (): void => {
    unregister?.()
    unregister = undefined
    const connection = getNetxConnection()
    if (connection === undefined) {
      ctx.logger.warn('netxops-tools: no connection yet — waiting for host settings bridge')
      return
    }
    unregister = registerNetxTools(ctx, connection)
    ctx.logger.info('netxops-tools: registered netx__* for Ops preset → %s', connection.apiUrl)
  }

  remount()
  const stopWatch = watchNetxConnection(() => { remount() })

  ctx.effect(() => () => {
    stopWatch()
    unregister?.()
    unregister = undefined
  }, 'netxops-tools: dispose')
}
