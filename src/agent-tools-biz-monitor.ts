/**
 * Forced bizMonitor-group tools + skill (cutover / biz_state read analysis).
 *
 * @module dsh-netxops/tools-biz-monitor
 */

import type { Context } from '@deepseek-ai/cordis'
import { applyGroupToolsPlugin } from './netx/group-tools-plugin.ts'

export const name = 'netxops-tools-biz-monitor'
export const inject = ['tools']

export function apply(ctx: Context): void {
  applyGroupToolsPlugin(ctx, { name, mode: 'forced', only: ['bizMonitor'] })
}
