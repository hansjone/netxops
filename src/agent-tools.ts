/**
 * Agent-plane aggregate mount: all capability groups gated by Settings inPreset.
 *
 * @module dsh-netxops/tools
 */

import type { Context } from '@deepseek-ai/cordis'
import { applyGroupToolsPlugin } from './netx/group-tools-plugin.ts'

/** Cordis plugin name. */
export const name = 'netxops-tools'

/** Tool registry must exist in this (preset-scoped) context. */
export const inject = ['tools']

/** Mount enabled groups for the Netx Ops preset. */
export function apply(ctx: Context): void {
  applyGroupToolsPlugin(ctx, { name, mode: 'settings' })
}
