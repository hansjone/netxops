/**
 * Register operator-subset knowledge pack skills into DSH when KB is configured.
 *
 * Sources (same plane / toggles / loadSkillBundle rules):
 * - `paths.skills` or default `_skills/` when `content.hasSkills`
 * - `paths.localSkills` when present (missing field or empty/missing dir → skip)
 */

import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { KbSnapshot } from './kb-manifest.ts'
import { loadSkillBundle } from './group-skills.ts'

export type KbSkillPlane = 'preset' | 'public'

type SkillsRegister = (skill: {
  name: string
  description: string
  content: string
  path?: string
  resourceBase?: { kind: 'directory'; path: string }
  provider?: string
  source: string
}) => () => void

/** True when MANIFEST says the package ships skill packs. */
export function kbPackSkillsEnabled(snapshot: KbSnapshot): boolean {
  return snapshot.status === 'configured' && snapshot.content.hasSkills === true
}

/** Shared pack root: MANIFEST `paths.skills` or legacy `_skills`. */
export function resolveKbSkillsRoot(snapshot: KbSnapshot): string {
  const rel = snapshot.paths.skills?.trim() || '_skills'
  return join(snapshot.realRoot, rel)
}

/**
 * Absolute local-skills root from MANIFEST `paths.localSkills`, or null when absent.
 */
export function resolveKbLocalSkillsRoot(snapshot: KbSnapshot): string | null {
  const rel = snapshot.paths.localSkills?.trim()
  if (!rel) return null
  return join(snapshot.realRoot, rel)
}

async function registerSkillsUnderRoot(
  ctx: Context,
  skillsApi: { register: SkillsRegister },
  root: string,
  provider: string,
  options: { logMissing: boolean; label: string },
): Promise<Array<() => void>> {
  let entries: string[]
  try {
    entries = await readdir(root)
  } catch {
    if (options.logMissing) {
      ctx.logger.info('netxops: kb %s dir missing at %s — skip', options.label, root)
    }
    return []
  }
  if (entries.length === 0) return []

  const disposers: Array<() => void> = []
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
        'netxops: kb %s skill load failed at %s: %s',
        options.label,
        full,
        error instanceof Error ? error.message : String(error),
      )
      continue
    }
    if (!skill) {
      ctx.logger.warn('netxops: kb %s skill skipped (invalid SKILL.md): %s', options.label, full)
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
  return disposers
}

/**
 * Register every valid skill under paths.skills (or `_skills`) and paths.localSkills.
 * No-op when not configured / hasSkills false.
 * localSkills: field missing or directory empty/missing → skip (no error).
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

  const skillsApi = (ctx as { skills?: { register: SkillsRegister } }).skills
  if (!skillsApi || typeof skillsApi.register !== 'function') {
    return () => {}
  }

  const provider = options.providerLabel ?? 'netxops-kb-pack'
  const disposers: Array<() => void> = []

  const skillsRoot = resolveKbSkillsRoot(snapshot)
  disposers.push(...await registerSkillsUnderRoot(ctx, skillsApi, skillsRoot, provider, {
    logMissing: true,
    label: 'pack',
  }))

  const localRoot = resolveKbLocalSkillsRoot(snapshot)
  if (localRoot) {
    disposers.push(...await registerSkillsUnderRoot(ctx, skillsApi, localRoot, provider, {
      logMissing: false,
      label: 'local',
    }))
  }

  if (disposers.length > 0) {
    ctx.logger.info(
      'netxops: kb pack skills registered count=%s skillsRoot=%s localSkills=%s provider=%s',
      disposers.length,
      skillsRoot,
      localRoot ?? '(none)',
      provider,
    )
  }

  return () => {
    for (const dispose of disposers) dispose()
  }
}
