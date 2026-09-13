/**
 * Register operator-subset knowledge pack skills (_skills dir) into DSH when KB is configured.
 */

import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { KbSnapshot } from './kb-manifest.ts'
import { loadSkillBundle } from './group-skills.ts'

export type KbSkillPlane = 'preset' | 'public'

/** True when MANIFEST says the package ships skill packs. */
export function kbPackSkillsEnabled(snapshot: KbSnapshot): boolean {
  return snapshot.status === 'configured' && snapshot.content.hasSkills === true
}

/**
 * Register every valid skill under realRoot/_skills.
 * No-op when not configured / hasSkills false / directory missing.
 * @returns disposer that unregisters all pack skills.
 */
export async function registerKbPackSkills(
  ctx: Context,
  snapshot: KbSnapshot,
  options: {
    enabled: boolean
    providerLabel?: string
  },
): Promise<() => void> {
  if (!options.enabled || !kbPackSkillsEnabled(snapshot)) {
    return () => {}
  }

  const skillsApi = (ctx as { skills?: { register: (skill: {
    name: string
    description: string
    content: string
    path?: string
    resourceBase?: { kind: 'directory'; path: string }
    provider?: string
    source: string
  }) => () => void } }).skills
  if (!skillsApi || typeof skillsApi.register !== 'function') {
    return () => {}
  }

  const root = join(snapshot.realRoot, '_skills')
  let entries: string[]
  try {
    entries = await readdir(root)
  } catch {
    ctx.logger.info('netxops: kb pack skills dir missing at %s — skip', root)
    return () => {}
  }

  const disposers: Array<() => void> = []
  const provider = options.providerLabel ?? 'netxops-kb-pack'
  for (const entry of entries) {
    const full = join(root, entry)
    let isDir = false
    try {
      isDir = (await stat(full)).isDirectory()
    } catch {
      continue
    }
    if (!isDir) continue
    let skill
    try {
      skill = await loadSkillBundle(full)
    } catch (error) {
      ctx.logger.warn(
        'netxops: kb pack skill load failed at %s: %s',
        full,
        error instanceof Error ? error.message : String(error),
      )
      continue
    }
    if (!skill) {
      ctx.logger.warn('netxops: kb pack skill skipped (invalid SKILL.md): %s', full)
      continue
    }
    disposers.push(skillsApi.register({
      name: skill.name,
      description: skill.description,
      content: skill.content,
      path: skill.path,
      resourceBase: { kind: 'directory', path: skill.directory },
      provider,
      source: 'custom',
    }))
  }

  if (disposers.length > 0) {
    ctx.logger.info(
      'netxops: kb pack skills registered count=%s root=%s provider=%s',
      disposers.length,
      root,
      provider,
    )
  }

  return () => {
    for (const dispose of disposers) dispose()
  }
}
