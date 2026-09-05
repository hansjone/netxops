/**
 * Register Ops playbook skills for enabled capability groups from disk.
 */

import { existsSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import {
  CAPABILITY_GROUP_IDS,
  SKILL_DIR_BY_GROUP,
  type NetxCapabilityGroupId,
} from './capability-groups.ts'

interface ParsedSkill {
  name: string
  description: string
  content: string
  path: string
  directory: string
}

/**
 * Package `presets/netxops/skills` root, or a shared netx skills checkout.
 *
 * Resolution order:
 * 1. `NETX_SKILLS_ROOT` (canonical `netx/skills`)
 * 2. Sibling `../netx/skills` when developing next to the netx repo
 * 3. Bundled `presets/netxops/skills` inside this package
 */
export function opsSkillsRoot(): string {
  const envRoot = process.env.NETX_SKILLS_ROOT?.trim()
  if (envRoot && existsSync(envRoot)) return envRoot

  const here = dirname(fileURLToPath(import.meta.url))
  const siblingCandidates = [
    // src/netx → ../../../netx/skills ; lib → ../../netx/skills
    join(here, '..', '..', '..', 'netx', 'skills'),
    join(here, '..', '..', 'netx', 'skills'),
  ]
  for (const candidate of siblingCandidates) {
    if (existsSync(candidate)) return candidate
  }

  const packaged = [
    join(here, '..', 'presets', 'netxops', 'skills'),
    join(here, '..', '..', 'presets', 'netxops', 'skills'),
  ]
  for (const candidate of packaged) {
    if (existsSync(candidate)) return candidate
  }
  return packaged[0]
}

function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } | undefined {
  if (!raw.startsWith('---')) return undefined
  const end = raw.indexOf('\n---', 3)
  if (end < 0) return undefined
  const yaml = raw.slice(3, end).replace(/^\r?\n/, '')
  const body = raw.slice(end + 4).replace(/^\r?\n/, '')
  const data: Record<string, unknown> = {}
  const lines = yaml.split(/\r?\n/)
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

async function loadSkillBundle(dir: string): Promise<ParsedSkill | null> {
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

async function loadGroupSkills(
  skillsRoot: string,
  groupId: NetxCapabilityGroupId,
): Promise<ParsedSkill[]> {
  const groupDir = join(skillsRoot, SKILL_DIR_BY_GROUP[groupId])
  let entries: string[]
  try {
    entries = await readdir(groupDir)
  } catch {
    return []
  }
  const skills: ParsedSkill[] = []
  for (const entry of entries) {
    const full = join(groupDir, entry)
    let isDir = false
    try {
      isDir = (await stat(full)).isDirectory()
    } catch {
      continue
    }
    if (!isDir) continue
    const skill = await loadSkillBundle(full)
    if (skill) skills.push(skill)
  }
  return skills
}

/**
 * Register playbook skills for the given capability groups into `ctx.skills`.
 * @param ctx - context with a skills registry (preset or host layer).
 * @param groupIds - enabled groups for this plane.
 * @param providerLabel - `provider` stamp on each registration.
 * @returns disposer that unregisters every skill.
 */
export async function registerGroupSkills(
  ctx: Context,
  groupIds: readonly NetxCapabilityGroupId[],
  providerLabel: string,
): Promise<() => void> {
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

  const root = opsSkillsRoot()
  const disposers: Array<() => void> = []
  const enabled = new Set(groupIds)
  for (const groupId of CAPABILITY_GROUP_IDS) {
    if (!enabled.has(groupId)) continue
    const skills = await loadGroupSkills(root, groupId)
    for (const skill of skills) {
      disposers.push(skillsApi.register({
        name: skill.name,
        description: skill.description,
        content: skill.content,
        path: skill.path,
        resourceBase: { kind: 'directory', path: skill.directory },
        provider: providerLabel,
        source: 'custom',
      }))
    }
  }

  return () => {
    for (const dispose of disposers) dispose()
  }
}
