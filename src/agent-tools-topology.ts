/**
 * Forced topology-group tools + skill (canvas / fabric / dual_unit / layout).
 *
 * @module dsh-netxops/tools-topology
 */

import type { Context } from '@deepseek-ai/cordis'
import { applyGroupToolsPlugin } from './netx/group-tools-plugin.ts'

export const name = 'netxops-tools-topology'
export const inject = ['tools']

export function apply(ctx: Context): void {
  applyGroupToolsPlugin(ctx, { name, mode: 'forced', only: ['topology'] })
}
