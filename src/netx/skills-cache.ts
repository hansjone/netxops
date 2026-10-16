/**
 * On-disk cache of netx MCP skill resources, keyed by API URL.
 *
 * Layout: `$DSH_HOME/netxops-mcp-skills/<key>/<groupDir>/<skill>/<relPath>`
 * plus `.meta.json` (listedAt, token fingerprint, per-group unavailable tools).
 */

import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  CAPABILITY_GROUP_IDS,
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
  /** SKILL.md only: server tools of this group the token cannot call. */
  unavailableTools?: readonly string[]
}

interface SkillsCacheMeta {
  apiUrl?: string
  mcpUrl?: string
  listedAt?: string
  fileCount?: number
  /** sha256 prefix of the token that pulled this cache. */
  tokenFp?: string
  unavailableTools?: Partial<Record<NetxCapabilityGroupId, string[]>>
}

/** Caches untouched for this long (other netx addresses) are pruned on refresh. */
const STALE_CACHE_MS = 30 * 24 * 60 * 60 * 1000

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

function cacheParent(): string {
  return join(dshHome(), 'netxops-mcp-skills')
}

/** Absolute cache root for one netx API URL (may not exist yet). */
export function skillsCacheDir(apiUrl: string): string {
  return join(cacheParent(), skillsCacheKey(apiUrl))
}

/** Short fingerprint of a token (never the token itself). */
export function tokenFingerprint(token: string): string {
  const raw = token.trim()
  return raw ? createHash('sha256').update(raw).digest('hex').slice(0, 16) : ''
}

function readMeta(root: string): SkillsCacheMeta | null {
  try {
    const meta = JSON.parse(readFileSync(join(root, '.meta.json'), 'utf8')) as unknown
    return meta && typeof meta === 'object' && !Array.isArray(meta) ? meta as SkillsCacheMeta : null
  } catch {
    return null
  }
}

/**
 * Cache root usable for this connection, or '' when the cache was pulled with
 * a different token (switching to a narrower token must not keep mounting the
 * broader token's skills while netx is offline).
 */
export function usableSkillsCacheDir(apiUrl: string, token: string): string {
  if (!apiUrl.trim()) return ''
  const root = skillsCacheDir(apiUrl)
  const pulledWith = readMeta(root)?.tokenFp
  if (pulledWith && pulledWith !== tokenFingerprint(token)) return ''
  return root
}

/** Per-group tools the pulling token could not call (from `.meta.json`). */
export function cachedUnavailableTools(root: string): Partial<Record<NetxCapabilityGroupId, string[]>> {
  const raw = readMeta(root)?.unavailableTools
  const out: Partial<Record<NetxCapabilityGroupId, string[]>> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const group of CAPABILITY_GROUP_IDS) {
    const names = raw[group]
    if (Array.isArray(names)) out[group] = names.filter((n): n is string => typeof n === 'string')
  }
  return out
}

function pruneStaleCaches(keep: string): void {
  const parent = cacheParent()
  let entries: string[]
  try {
    entries = readdirSync(parent)
  } catch {
    return
  }
  const now = Date.now()
  for (const name of entries) {
    const dir = join(parent, name)
    if (dir === keep) continue
    try {
      const listedAt = Date.parse(readMeta(dir)?.listedAt ?? '')
      const age = now - (Number.isFinite(listedAt) ? listedAt : statSync(dir).mtimeMs)
      if (age > STALE_CACHE_MS) rmSync(dir, { recursive: true, force: true })
    } catch {
      // best effort
    }
  }
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
export function replaceSkillsCache(
  apiUrl: string,
  files: readonly CachedSkillFile[],
  options: { token?: string } = {},
): string {
  const root = skillsCacheDir(apiUrl)
  rmSync(root, { recursive: true, force: true })
  mkdirSync(root, { recursive: true })
  let written = 0
  const unavailableTools: Partial<Record<NetxCapabilityGroupId, string[]>> = {}
  for (const file of files) {
    if (file.unavailableTools?.length && SKILL_DIR_BY_GROUP[file.group]) {
      const merged = new Set([...(unavailableTools[file.group] ?? []), ...file.unavailableTools])
      unavailableTools[file.group] = [...merged].sort()
    }
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
  const meta: SkillsCacheMeta = {
    apiUrl: normalized,
    mcpUrl: normalized ? `${normalized}/mcp` : '',
    listedAt: new Date().toISOString(),
    fileCount: written,
    ...(options.token !== undefined ? { tokenFp: tokenFingerprint(options.token) } : {}),
    unavailableTools,
  }
  writeFileSync(join(root, '.meta.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
  summaryMemo.delete(root)
  pruneStaleCaches(root)
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

/** One cached skill as shown on the Plugins card. */
export interface CachedSkillSummary {
  group: NetxCapabilityGroupId
  name: string
  files: number
}

function countFiles(dir: string): number {
  let n = 0
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    n += statSync(full).isDirectory() ? countFiles(full) : 1
  }
  return n
}

type CachedSkillsListing = { listedAt: string | null; skills: CachedSkillSummary[] }

/** root → listing; invalidated by replaceSkillsCache, keyed by .meta.json listedAt. */
const summaryMemo = new Map<string, CachedSkillsListing>()

/** Skills the plugin will mount for this connection (Plugins card polls this). */
export function listCachedSkills(apiUrl: string, token = ''): CachedSkillsListing {
  const root = usableSkillsCacheDir(apiUrl, token)
  if (!root || !existsSync(root)) return { listedAt: null, skills: [] }
  const metaListedAt = readMeta(root)?.listedAt
  const listedAt = typeof metaListedAt === 'string' ? metaListedAt : null
  const memo = summaryMemo.get(root)
  if (memo && memo.listedAt === listedAt) return memo
  const skills: CachedSkillSummary[] = []
  for (const group of CAPABILITY_GROUP_IDS) {
    const groupDir = join(root, SKILL_DIR_BY_GROUP[group])
    if (!existsSync(groupDir)) continue
    try {
      for (const name of readdirSync(groupDir).sort()) {
        const dir = join(groupDir, name)
        if (!statSync(dir).isDirectory() || !existsSync(join(dir, 'SKILL.md'))) continue
        skills.push({ group, name, files: countFiles(dir) })
      }
    } catch {
      // unreadable group dir → skip
    }
  }
  const listing = { listedAt, skills }
  summaryMemo.set(root, listing)
  return listing
}
