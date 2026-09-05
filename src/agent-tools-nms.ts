/**
 * @deprecated Use `dsh-netxops/tools-ops`. Alias that still forces the ops group.
 * @module dsh-netxops/tools-nms
 */

import type { Context } from '@deepseek-ai/cordis'
import { applyGroupToolsPlugin } from './netx/group-tools-plugin.ts'

export const name = 'netxops-tools-nms'
export const inject = ['tools']

export function apply(ctx: Context): void {
  applyGroupToolsPlugin(ctx, { name, mode: 'forced', only: ['ops'] })
}
