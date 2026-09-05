/**
 * Forced ops-group tools + skill (NMS + managed CLI + paths).
 *
 * @module dsh-netxops/tools-ops
 */

import type { Context } from '@deepseek-ai/cordis'
import { applyGroupToolsPlugin } from './netx/group-tools-plugin.ts'

export const name = 'netxops-tools-ops'
export const inject = ['tools']

export function apply(ctx: Context): void {
  applyGroupToolsPlugin(ctx, { name, mode: 'forced', only: ['ops'] })
}
