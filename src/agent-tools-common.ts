/**
 * Forced common-group tools + skill (native managed CLI + findTopologyPaths).
 *
 * @module dsh-netxops/tools-common
 */

import type { Context } from '@deepseek-ai/cordis'
import { applyGroupToolsPlugin } from './netx/group-tools-plugin.ts'

export const name = 'netxops-tools-common'
export const inject = ['tools']

export function apply(ctx: Context): void {
  applyGroupToolsPlugin(ctx, { name, mode: 'forced', only: ['common'] })
}
