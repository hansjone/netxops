/**
 * Forced nms-group tools + skill (vendor NMS adapter; current provider zte-ume).
 * Mount this export in any agent preset that needs NMS alarms/inventory.
 *
 * @module dsh-netxops/tools-nms
 */

import type { Context } from '@deepseek-ai/cordis'
import { applyGroupToolsPlugin } from './netx/group-tools-plugin.ts'

export const name = 'netxops-tools-nms'
export const inject = ['tools']

export function apply(ctx: Context): void {
  applyGroupToolsPlugin(ctx, { name, mode: 'forced', only: ['nms'] })
}
