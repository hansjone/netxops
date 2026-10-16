/**
 * Register Ops playbook skills for enabled capability groups from the
 * on-disk MCP skills cache (`skills-cache.ts`).
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import {
  CAPABILITY_GROUP_IDS,
  SKILL_DIR_BY_GROUP,
  type NetxCapabilityGroupId,
} from './capability-groups.ts'
import { getNetxConnection } from './runtime.ts'
import { cachedUnavailableTools, usableSkillsCacheDir } from './skills-cache.ts'
import { publicToolName } from './mcp-types.ts'

interface ParsedSkill {
  name: string
  description: string
  content: string
  path: string
  directory: string
}

export type { ParsedSkill }

function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } | undefined {
  // Windows CRLF (and mixed) checkouts break `$`-anchored YAML lines: a trailing
  // `\r` is a JS line terminator, so `.` and `$` both refuse it and description
  // silently drops — netx-ops then never registers. Normalize before parse.
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!text.startsWith('---')) return undefined
  const end = text.indexOf('\n---', 3)
  if (end < 0) return undefined
  const yaml = text.slice(3, end).replace(/^\n/, '')
  const body = text.slice(end + 4).replace(/^\n/, '')
  const data: Record<string, unknown> = {}
  const lines = yaml.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const nameMatch = /^name\s*:\s*(.+)\s*$/.exec(line)
    if (nameMatch) {
      data.name = stripQuotes(nameMatch[1].trim())
      continue
    }
    const descMatch = /^description\s*:\s*(.*)$/.exec(line)
    if (!descMatch) continue
    const head = descMatch[1].trim()
    if (head === '>' || head === '>-' || head === '|' || head === '|-') {
      const parts: string[] = []
      while (i + 1 < lines.length && /^[ \t]+/.test(lines[i + 1])) {
        i += 1
        parts.push(lines[i].trim())
      }
      data.description = parts.filter(Boolean).join(' ')
      continue
    }
    data.description = stripQuotes(head)
  }
  return { data, body }
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
}

/**
 * Load one skill directory (`SKILL.md` + frontmatter). Exported for KB pack loader.
 */
export async function loadSkillBundle(dir: string): Promise<ParsedSkill | null> {
  const skillPath = join(dir, 'SKILL.md')
  let raw: string
  try {
    raw = await readFile(skillPath, 'utf8')
  } catch {
    return null
  }
  const parsed = parseFrontmatter(raw)
  if (!parsed) return null
  const name = typeof parsed.data.name === 'string' ? parsed.data.name.trim() : ''
  const description = typeof parsed.data.description === 'string'
    ? parsed.data.description.trim()
    : ''
  if (!name || !description) return null
  return {
    name,
    description,
    content: parsed.body.trimStart(),
    path: skillPath,
    directory: dir,
  }
}

/** Why a skill directory was skipped (for Host logs). */
export type SkillLoadSkip = { directory: string; reason: string }

async function loadGroupSkills(
  skillsRoot: string,
  groupId: NetxCapabilityGroupId,
): Promise<{ skills: ParsedSkill[]; skipped: SkillLoadSkip[] }> {
  const groupDir = join(skillsRoot, SKILL_DIR_BY_GROUP[groupId])
  let entries: string[]
  try {
    entries = await readdir(groupDir)
  } catch {
    return { skills: [], skipped: [{ directory: groupDir, reason: 'missing group dir' }] }
  }
  const skills: ParsedSkill[] = []
  const skipped: SkillLoadSkip[] = []
  for (const entry of entries) {
    const full = join(groupDir, entry)
    let isDir = false
    try {
      isDir = (await stat(full)).isDirectory()
    } catch {
      continue
    }
    if (!isDir) continue
    const skillPath = join(full, 'SKILL.md')
    let raw: string
    try {
      raw = await readFile(skillPath, 'utf8')
    } catch {
      skipped.push({ directory: full, reason: 'no SKILL.md' })
      continue
    }
    const parsed = parseFrontmatter(raw)
    if (!parsed) {
      skipped.push({ directory: full, reason: 'invalid frontmatter' })
      continue
    }
    const name = typeof parsed.data.name === 'string' ? parsed.data.name.trim() : ''
    const description = typeof parsed.data.description === 'string'
      ? parsed.data.description.trim()
      : ''
    if (!name || !description) {
      skipped.push({
        directory: full,
        reason: !name ? 'missing name' : 'missing description',
      })
      continue
    }
    skills.push({
      name,
      description,
      content: parsed.body.trimStart(),
      path: skillPath,
      directory: full,
    })
  }
  return { skills, skipped }
}

/** Per-group model-facing tool names (`netx__*`) that are off while the group skill still mounts. */
export type DisabledToolsByGroup = Partial<Record<NetxCapabilityGroupId, readonly string[]>>

export interface RegisterGroupSkillsOptions {
  signal?: AbortSignal
  /**
   * When a group is enabled but some tools are filtered out (disabledTools /
   * readOnlyOnly), append a short "do not call" footnote listing public names.
   */
  disabledByGroup?: DisabledToolsByGroup
  lang?: string
  /**
   * Cache root containing `ops` / `topology` / `biz-monitor`.
   * Tests inject this; production resolves `$DSH_HOME/netxops-mcp-skills/<key>`
   * from the live connection apiUrl.
   */
  skillsRoot?: string
}

function disabledFootnote(names: readonly string[], lang?: string): string {
  if (names.length === 0) return ''
  const list = names.join(', ')
  const en = (lang ?? '').trim().toLowerCase().startsWith('en')
  return en
    ? `\n\n## Unavailable tools\nThe following tools are disabled or not granted to this token: ${list}. Do not call them; skip steps that need them.\n`
    : `\n\n## 不可用工具\n以下工具已禁用或当前 token 无权使用：${list}，不要调用，涉及它们的步骤请跳过。\n`
}

function resolveSkillsRoot(options: RegisterGroupSkillsOptions): string {
  if (typeof options.skillsRoot === 'string' && options.skillsRoot.trim()) {
    return options.skillsRoot.trim()
  }
  const connection = getNetxConnection()
  if (!connection?.apiUrl?.trim()) return ''
  return usableSkillsCacheDir(connection.apiUrl, connection.token ?? '')
}

/**
 * Register playbook skills for the given capability groups into `ctx.skills`.
 * Groups that are off are skipped entirely (no skill injection).
 * @param ctx - context with a skills registry (preset or host layer).
 * @param groupIds - enabled groups for this plane.
 * @param providerLabel - `provider` stamp on each registration.
 * @returns disposer that unregisters every skill.
 */
export async function registerGroupSkills(
  ctx: Context,
  groupIds: readonly NetxCapabilityGroupId[],
  providerLabel: string,
  signalOrOptions?: AbortSignal | RegisterGroupSkillsOptions,
): Promise<() => void> {
  const options: RegisterGroupSkillsOptions = signalOrOptions instanceof AbortSignal
    || signalOrOptions === undefined
    ? { signal: signalOrOptions }
    : signalOrOptions
  const signal = options.signal
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

  const root = resolveSkillsRoot(options)
  const disposers: Array<() => void> = []
  const enabled = new Set(groupIds)
  const log = (ctx as { logger?: { warn: (msg: string, ...args: unknown[]) => void } }).logger
  if (!root) {
    if (enabled.size > 0) {
      log?.warn?.('%s: no MCP skills cache (missing apiUrl)', providerLabel)
    }
    return () => {}
  }
  const unavailable = cachedUnavailableTools(root)
  try {
    for (const groupId of CAPABILITY_GROUP_IDS) {
      if (!enabled.has(groupId)) continue
      const { skills, skipped } = await loadGroupSkills(root, groupId)
      if (signal?.aborted) break
      for (const miss of skipped) {
        log?.warn?.('%s: skip skill dir %s (%s)', providerLabel, miss.directory, miss.reason)
      }
      if (skills.length === 0) {
        log?.warn?.(
          '%s: no skills loaded for group=%s from %s',
          providerLabel,
          groupId,
          join(root, SKILL_DIR_BY_GROUP[groupId]),
        )
      }
      const offNames = new Set([
        ...(options.disabledByGroup?.[groupId] ?? []),
        ...(unavailable[groupId] ?? []).map(publicToolName),
      ])
      const footnote = disabledFootnote([...offNames].sort(), options.lang)
      for (const skill of skills) {
        const base = groupId === 'topology'
          ? `${skill.content}\n\n## DeepSeek Harness REST capabilities\nUse only tools present in this session. Dual-unit/orbit/polish recipes require server-side topology tools. Use only tools present in this session.\n`
          : skill.content
        disposers.push(skillsApi.register({
          name: skill.name,
          description: skill.description,
          content: `${base}${footnote}`,
          path: skill.path,
          resourceBase: { kind: 'directory', path: skill.directory },
          provider: providerLabel,
          source: 'custom',
        }))
      }
    }
    if (signal?.aborted) {
      for (const dispose of disposers.splice(0)) dispose()
    }
  } catch (error) {
    for (const dispose of disposers.splice(0)) dispose()
    throw error
  }

  return () => {
    for (const dispose of disposers) dispose()
  }
}
