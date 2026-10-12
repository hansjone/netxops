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
import { renderKbPathTable, type KbSnapshot } from './kb-manifest.ts'
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
 * Appended to every pack skill: the playbooks say "read MANIFEST paths, never compose",
 * so hand them the resolved anchors instead of costing a MANIFEST read per task.
 */
export function kbPackSkillFooter(snapshot: KbSnapshot): string {
  return [
    '',
    '',
    `## Injected KB anchors (netxops · ${snapshot.operatorName} / ${snapshot.country} v${snapshot.version})`,
    '',
    `kbStatus=configured · kbRoot=\`${snapshot.realRoot}\``,
    '',
    renderKbPathTable(snapshot),
    '',
    'These are already resolved from `MANIFEST.json` `paths.*`; use them verbatim.',
    'Read/search the pack with `netx__kbRead` / `netx__kbSearch` when present; write only via `netx__kbWrite*`.',
    '',
  ].join('\n')
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
  options: {
    logMissing: boolean
    label: string
    signal?: AbortSignal
    footer: string
    /** Names already registered by an earlier root (pack before local). */
    seen: Set<string>
  },
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
  try {
    for (const entry of entries) {
      if (options.signal?.aborted) break
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
      if (options.signal?.aborted) break
      if (options.seen.has(skill.name)) {
        ctx.logger.warn(
          'netxops: kb %s skill %s duplicates an already registered pack skill — skip %s',
          options.label,
          skill.name,
          full,
        )
        continue
      }
      try {
        disposers.push(skillsApi.register({
          name: skill.name,
          description: skill.description,
          content: `${skill.content.trimEnd()}${options.footer}`,
          path: skill.path,
          resourceBase: { kind: 'directory', path: skill.directory },
          provider,
          source: 'custom',
        }))
        options.seen.add(skill.name)
      } catch (error) {
        // One rejected bundle must not take the rest of the pack down with it.
        ctx.logger.warn(
          'netxops: kb %s skill %s register failed: %s',
          options.label,
          skill.name,
          error instanceof Error ? error.message : String(error),
        )
      }
    }
  } catch (error) {
    for (const dispose of disposers.splice(0)) dispose()
    throw error
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
    signal?: AbortSignal
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
  const localRoot = resolveKbLocalSkillsRoot(snapshot)
  const footer = kbPackSkillFooter(snapshot)
  const seen = new Set<string>()
  try {
    disposers.push(...await registerSkillsUnderRoot(ctx, skillsApi, skillsRoot, provider, {
      logMissing: true,
      label: 'pack',
      signal: options.signal,
      footer,
      seen,
    }))

    if (localRoot) {
      disposers.push(...await registerSkillsUnderRoot(ctx, skillsApi, localRoot, provider, {
        logMissing: false,
        label: 'local',
        signal: options.signal,
        footer,
        seen,
      }))
    }
  } catch (error) {
    for (const dispose of disposers.splice(0)) dispose()
    throw error
  }
  if (options.signal?.aborted) {
    for (const dispose of disposers.splice(0)) dispose()
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
