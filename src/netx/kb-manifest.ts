/**
 * Locate and validate an operator-subset MANIFEST.json under a kbRoot.
 *
 * Contract (MANIFEST v1.0):
 * - schemaVersion === "1.0"
 * - packageType === "operator-subset"
 * - operator.name / operator.country, version required
 * - content.* boolean flags (missing → false)
 * - paths.* optional relative dirs (packaging-generated; missing keys skipped)
 *
 * Location: `${kbRoot}/MANIFEST.json`, else recurse ≤ maxDepth and accept
 * exactly one hit (0 or >1 → error).
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

/** Known content flags (MANIFEST contract v1.0); unknown boolean keys may be preserved. */
export interface KbContentFlags {
  hasRegions: boolean
  hasTheory: boolean
  hasPacket: boolean
  hasCommon: boolean
  hasSkills: boolean
  [key: string]: boolean
}

/**
 * Packaging-generated relative paths under the package root.
 * Plugin uses `skills` / `localSkills` for skill registration; other keys are preserved.
 */
export interface KbPaths {
  /** Shared skill packs (default `_skills` when absent). */
  skills?: string
  /** Operator-local skills (optional; missing/empty → skip). */
  localSkills?: string
  [key: string]: string | undefined
}

export type KbStatus = 'unconfigured' | 'configured' | 'error'

export interface KbSnapshot {
  status: KbStatus
  /** Absolute real package root (directory that holds MANIFEST.json). */
  realRoot: string
  operatorName: string
  country: string
  version: string
  content: KbContentFlags
  /** Relative paths from MANIFEST `paths` (empty when absent). */
  paths: KbPaths
  errorMessage: string
}

const EMPTY_CONTENT: KbContentFlags = {
  hasRegions: false,
  hasTheory: false,
  hasPacket: false,
  hasCommon: false,
  hasSkills: false,
}

/** Legacy short keys → contract `has*` (one-release compat). */
const LEGACY_CONTENT_KEY: Record<string, keyof KbContentFlags> = {
  regions: 'hasRegions',
  theory: 'hasTheory',
  packet: 'hasPacket',
  skills: 'hasSkills',
  common: 'hasCommon',
}

/** Empty / unconfigured snapshot (kbRoot blank). */
export function unconfiguredKbSnapshot(): KbSnapshot {
  return {
    status: 'unconfigured',
    realRoot: '',
    operatorName: '',
    country: '',
    version: '',
    content: { ...EMPTY_CONTENT },
    paths: {},
    errorMessage: '',
  }
}

function errorSnapshot(message: string): KbSnapshot {
  return {
    status: 'error',
    realRoot: '',
    operatorName: '',
    country: '',
    version: '',
    content: { ...EMPTY_CONTENT },
    paths: {},
    errorMessage: message,
  }
}

/**
 * Recursively collect `MANIFEST.json` paths under `root`, depth-limited.
 * Depth 0 = root itself; children are depth 1..maxDepth.
 */
export function findManifest(
  kbRoot: string,
  maxDepth = 3,
): { paths: string[]; error?: string } {
  const root = resolve(kbRoot.trim())
  if (!kbRoot.trim()) {
    return { paths: [], error: 'kbRoot is empty' }
  }
  let rootStat
  try {
    rootStat = statSync(root)
  } catch {
    return { paths: [], error: `kbRoot not found: ${root}` }
  }
  if (!rootStat.isDirectory()) {
    return { paths: [], error: `kbRoot is not a directory: ${root}` }
  }

  const direct = join(root, 'MANIFEST.json')
  if (existsSync(direct)) {
    try {
      if (statSync(direct).isFile()) return { paths: [direct] }
    } catch {
      // fall through to search
    }
  }

  const found: string[] = []
  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth) return
    const candidate = join(dir, 'MANIFEST.json')
    if (existsSync(candidate)) {
      try {
        if (statSync(candidate).isFile()) found.push(candidate)
      } catch {
        // ignore unreadable
      }
    }
    if (depth === maxDepth) return
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      if (name === 'node_modules' || name === '.git') continue
      const full = join(dir, name)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) walk(full, depth + 1)
    }
  }
  // Root already checked; search nested packages at depth 1..maxDepth.
  let topEntries: string[]
  try {
    topEntries = readdirSync(root)
  } catch {
    return { paths: [], error: `cannot read kbRoot: ${root}` }
  }
  for (const name of topEntries) {
    if (name === 'node_modules' || name === '.git') continue
    const full = join(root, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(full, 1)
  }
  return { paths: found }
}

function asNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`MANIFEST missing required string field: ${field}`)
  }
  return value.trim()
}

function parseContent(raw: unknown): KbContentFlags {
  const out: KbContentFlags = { ...EMPTY_CONTENT }
  if (raw === undefined || raw === null) {
    throw new Error('MANIFEST missing required object field: content')
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('MANIFEST content must be an object')
  }
  const row = raw as Record<string, unknown>
  const present = new Set(Object.keys(row))
  for (const [key, value] of Object.entries(row)) {
    const on = value === true
    const mapped = LEGACY_CONTENT_KEY[key]
    if (mapped !== undefined) {
      // Short keys only fill has* when the contract key is absent (no dual truth).
      if (on && !present.has(mapped)) out[mapped] = true
      continue
    }
    out[key] = on
  }
  return out
}

/**
 * Parse optional MANIFEST `paths` map (relative dirs under package root).
 * Missing / null → {}; non-string or blank values skipped; invalid type → error.
 */
export function parsePaths(raw: unknown): KbPaths {
  if (raw === undefined || raw === null) return {}
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('MANIFEST paths must be an object')
  }
  const out: KbPaths = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (!trimmed) continue
    out[key] = trimmed
  }
  return out
}

/**
 * Parse and validate MANIFEST JSON text (UTF-8).
 * @throws Error with a short message when invalid.
 */
export function parseManifest(raw: string): {
  operatorName: string
  country: string
  version: string
  content: KbContentFlags
  paths: KbPaths
} {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch (error) {
    throw new Error(
      `MANIFEST is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('MANIFEST root must be an object')
  }
  const row = data as Record<string, unknown>
  if (row.schemaVersion !== '1.0') {
    throw new Error(
      `unsupported schemaVersion (want "1.0", got ${JSON.stringify(row.schemaVersion)})`,
    )
  }
  if (row.packageType !== 'operator-subset') {
    throw new Error(
      `unsupported packageType (want "operator-subset", got ${JSON.stringify(row.packageType)})`,
    )
  }
  const operator = row.operator
  if (operator === null || typeof operator !== 'object' || Array.isArray(operator)) {
    throw new Error('MANIFEST missing required object field: operator')
  }
  const op = operator as Record<string, unknown>
  return {
    operatorName: asNonEmptyString(op.name, 'operator.name'),
    country: asNonEmptyString(op.country, 'operator.country'),
    version: asNonEmptyString(row.version, 'version'),
    content: parseContent(row.content),
    paths: parsePaths(row.paths),
  }
}

/**
 * Resolve kbRoot → KbSnapshot (unconfigured / configured / error).
 * Accepts a directory, or a path directly to MANIFEST.json (uses its parent).
 */
export function resolveKbRoot(kbRoot: string, maxDepth = 3): KbSnapshot {
  const trimmed = kbRoot.trim()
  if (!trimmed) return unconfiguredKbSnapshot()

  let root = resolve(trimmed)
  try {
    const st = statSync(root)
    if (st.isFile()) {
      if (basename(root).toLowerCase() === 'manifest.json') {
        root = dirname(root)
      } else {
        return errorSnapshot(`kbRoot is not a directory: ${root}`)
      }
    } else if (!st.isDirectory()) {
      return errorSnapshot(`kbRoot is not a directory: ${root}`)
    }
  } catch {
    return errorSnapshot(`kbRoot not found: ${root}`)
  }

  const located = findManifest(root, maxDepth)
  if (located.error) return errorSnapshot(located.error)
  if (located.paths.length === 0) {
    return errorSnapshot(`no MANIFEST.json under ${root} (maxDepth=${maxDepth})`)
  }
  if (located.paths.length > 1) {
    return errorSnapshot(
      `ambiguous MANIFEST.json (${located.paths.length} hits); pick a unique package root`,
    )
  }

  const manifestPath = located.paths[0]!
  let raw: string
  try {
    raw = readFileSync(manifestPath, 'utf8')
  } catch (error) {
    return errorSnapshot(
      `cannot read MANIFEST: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  try {
    const parsed = parseManifest(raw)
    return {
      status: 'configured',
      realRoot: dirname(manifestPath),
      operatorName: parsed.operatorName,
      country: parsed.country,
      version: parsed.version,
      content: parsed.content,
      paths: { ...parsed.paths },
      errorMessage: '',
    }
  } catch (error) {
    return errorSnapshot(error instanceof Error ? error.message : String(error))
  }
}
