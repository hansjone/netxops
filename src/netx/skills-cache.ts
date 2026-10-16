/**
 * On-disk cache of netx MCP skill resources, keyed by API URL.
 *
 * Layout: `$DSH_HOME/netxops-mcp-skills/<key>/<groupDir>/<skill>/<relPath>`
 */

import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  SKILL_DIR_BY_GROUP,
  type NetxCapabilityGroupId,
} from './capability-groups.ts'
import { normalizeApiUrl } from './http.ts'

export interface CachedSkillFile {
  group: NetxCapabilityGroupId
  skill: string
  /** Posix-relative path inside the skill directory (e.g. `SKILL.md`). */
  relPath: string
  text: string
}

function dshHome(): string {
  const fromEnv = process.env.DSH_HOME?.trim()
  return fromEnv || join(homedir(), '.dsh')
}

/** Normalize apiUrl the same way connection settings do. */
export function normalizeSkillsApiUrl(apiUrl: string): string {
  const normalized = normalizeApiUrl(apiUrl)
  return normalized.ok ? normalized.url : apiUrl.trim().replace(/\/$/, '')
}

/** Stable short key so each netx address gets its own cache tree. */
export function skillsCacheKey(apiUrl: string): string {
  const base = normalizeSkillsApiUrl(apiUrl)
  return createHash('sha256').update(base).digest('hex').slice(0, 16)
}

/** Absolute cache root for one netx API URL (may not exist yet). */
export function skillsCacheDir(apiUrl: string): string {
  return join(dshHome(), 'netxops-mcp-skills', skillsCacheKey(apiUrl))
}

function isSafeSegment(value: string): boolean {
  return Boolean(value)
    && !value.includes('..')
    && !value.includes('/')
    && !value.includes('\\')
    && !value.includes('\0')
}

function isSafeRelPath(relPath: string): boolean {
  if (!relPath || relPath.startsWith('/') || relPath.includes('\0')) return false
  const parts = relPath.replace(/\\/g, '/').split('/')
  return parts.every((part) => part.length > 0 && part !== '.' && part !== '..')
}

/**
 * Replace the cache for `apiUrl` with `files` (empty → wipe).
 * Call only after a successful tools/list when skills were resolved
 * (including “no resources / empty list”).
 */
export function replaceSkillsCache(apiUrl: string, files: readonly CachedSkillFile[]): string {
  const root = skillsCacheDir(apiUrl)
  rmSync(root, { recursive: true, force: true })
  mkdirSync(root, { recursive: true })
  let written = 0
  for (const file of files) {
    const groupDir = SKILL_DIR_BY_GROUP[file.group]
    if (!groupDir || !isSafeSegment(file.skill) || !isSafeRelPath(file.relPath)) continue
    const rel = file.relPath.replace(/\\/g, '/')
    const dest = join(root, groupDir, file.skill, ...rel.split('/'))
    mkdirSync(dirname(dest), { recursive: true })
    const text = file.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    writeFileSync(dest, text, 'utf8')
    written += 1
  }
  const normalized = normalizeSkillsApiUrl(apiUrl)
  const meta = {
    apiUrl: normalized,
    mcpUrl: normalized ? `${normalized}/mcp` : '',
    listedAt: new Date().toISOString(),
    fileCount: written,
  }
  writeFileSync(join(root, '.meta.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
  return root
}

/** True when a previous successful skill pull left a cache directory. */
export function hasSkillsCache(apiUrl: string): boolean {
  const root = skillsCacheDir(apiUrl)
  if (!existsSync(root)) return false
  try {
    return readdirSync(root).some((name) => name !== '.meta.json')
  } catch {
    return false
  }
}
