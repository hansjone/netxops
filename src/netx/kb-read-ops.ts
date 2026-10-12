/**
 * Read-only access to the whole operator-subset package (HQ pack + `_local`),
 * jailed to `realRoot`. Host-side so it works regardless of the workspace sandbox.
 */

import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { extname, join, relative, resolve, sep } from 'node:path'
import { resolveKbPaths, type KbSnapshot } from './kb-manifest.ts'

const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.json', '.yml', '.yaml', '.csv', '.ps1', '.sh', '.cfg', '.conf', '.log'])
const SKIP_DIRS = new Set(['.git', 'node_modules'])
const READ_DEFAULT_LINES = 400
const READ_MAX_LINES = 2_000
const READ_MAX_CHARS = 80_000
const SEARCH_MAX_FILE_BYTES = 2 * 1024 * 1024
const SEARCH_HITS_PER_FILE = 4
const CACHE_MAX_CHARS = 64 * 1024 * 1024

function requireRoot(snapshot: KbSnapshot): string {
  if (snapshot.status !== 'configured' || !snapshot.realRoot) {
    throw new Error('knowledge base not configured (set kbRoot to a folder with MANIFEST.json)')
  }
  return snapshot.realRoot
}

function toPosix(rel: string): string {
  return rel.split(sep).join('/')
}

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !rel.split(/[/\\]/).includes('..') && !/^[a-zA-Z]:/.test(rel))
}

/**
 * Resolve `pathArg` (absolute, or relative to kbRoot, or `paths.<key>` shorthand like `rca`)
 * to a real path inside the package. Symlinks are followed and re-checked.
 */
export function resolveKbReadPath(snapshot: KbSnapshot, pathArg: string): { absolutePath: string; relativePath: string } {
  const root = requireRoot(snapshot)
  const trimmed = pathArg.trim().replace(/^["']|["']$/g, '')
  if (trimmed.includes('\0')) throw new Error('path contains NUL')
  const anchor = resolveKbPaths(snapshot).find(row => row.key === trimmed)
  const candidate = anchor
    ? anchor.absolute
    : (!trimmed || trimmed === '.' || trimmed === '/') ? root : resolve(root, trimmed)
  if (!isInside(root, candidate)) throw new Error(`path escapes kbRoot: ${candidate}`)
  let real: string
  try {
    real = realpathSync(candidate)
  } catch {
    throw new Error(`not found in KB: ${toPosix(relative(root, candidate)) || '.'}`)
  }
  const realRoot = realpathSync(root)
  if (!isInside(realRoot, real)) throw new Error(`path escapes kbRoot after realpath: ${real}`)
  return { absolutePath: real, relativePath: toPosix(relative(realRoot, real)) || '.' }
}

export type KbReadResult =
  | {
    ok: true
    kind: 'file'
    absolutePath: string
    relativePath: string
    totalLines: number
    startLine: number
    endLine: number
    truncated: boolean
    text: string
  }
  | {
    ok: true
    kind: 'directory'
    absolutePath: string
    relativePath: string
    entries: Array<{ name: string; type: 'dir' | 'file'; size?: number }>
  }

/**
 * Read a KB file (1-based `offset`, `limit` lines) or list a KB directory.
 */
export function readKbFile(
  snapshot: KbSnapshot,
  args: { path: string; offset?: number; limit?: number },
): KbReadResult {
  const target = resolveKbReadPath(snapshot, args.path)
  const st = statSync(target.absolutePath)
  if (st.isDirectory()) {
    const entries = readdirSync(target.absolutePath, { withFileTypes: true })
      .filter(entry => !SKIP_DIRS.has(entry.name))
      .map((entry) => {
        if (entry.isDirectory()) return { name: entry.name, type: 'dir' as const }
        let size: number | undefined
        try { size = statSync(join(target.absolutePath, entry.name)).size } catch { /* ignore */ }
        return { name: entry.name, type: 'file' as const, size }
      })
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))
    return { ok: true, kind: 'directory', ...target, entries }
  }
  if (!TEXT_EXTENSIONS.has(extname(target.absolutePath).toLowerCase())) {
    throw new Error(`not a text KB file: ${target.relativePath}`)
  }
  const lines = readFileSync(target.absolutePath, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')
  const start = Math.max(1, Math.floor(args.offset ?? 1))
  const limit = Math.min(Math.max(1, Math.floor(args.limit ?? READ_DEFAULT_LINES)), READ_MAX_LINES)
  let slice = lines.slice(start - 1, start - 1 + limit)
  let text = slice.join('\n')
  let truncated = start - 1 + slice.length < lines.length
  if (text.length > READ_MAX_CHARS) {
    let used = 0
    let keep = 0
    for (const line of slice) {
      if (used + line.length + 1 > READ_MAX_CHARS) break
      used += line.length + 1
      keep += 1
    }
    slice = slice.slice(0, Math.max(keep, 1))
    text = slice.join('\n').slice(0, READ_MAX_CHARS)
    truncated = true
  }
  return {
    ok: true,
    kind: 'file',
    ...target,
    totalLines: lines.length,
    startLine: start,
    endLine: start - 1 + slice.length,
    truncated,
    text,
  }
}

interface CachedFile {
  mtimeMs: number
  size: number
  text: string
  /** Lower-cased once so plain searches don't re-lowercase every file per term. */
  lower: string
}

const CACHE_KEY = Symbol.for('dsh-netxops.kb-search-cache')

function searchCache(): { files: Map<string, CachedFile>; chars: number } {
  const root = globalThis as typeof globalThis & { [CACHE_KEY]?: { files: Map<string, CachedFile>; chars: number } }
  root[CACHE_KEY] ??= { files: new Map(), chars: 0 }
  return root[CACHE_KEY]
}

/** Read through a stat-validated cache so repeated searches don't re-read the pack. */
function cachedText(path: string, mtimeMs: number, size: number): CachedFile {
  const cache = searchCache()
  const hit = cache.files.get(path)
  if (hit && hit.mtimeMs === mtimeMs && hit.size === size) return hit
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
  if (hit) cache.chars -= hit.text.length
  if (cache.chars + text.length > CACHE_MAX_CHARS) {
    cache.files.clear()
    cache.chars = 0
  }
  const entry = { mtimeMs, size, text, lower: text.toLowerCase() }
  cache.files.set(path, entry)
  cache.chars += text.length
  return entry
}

function walkTextFiles(dir: string, out: Array<{ path: string; mtimeMs: number; size: number }>): void {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walkTextFiles(full, out)
      continue
    }
    if (!entry.isFile() || !TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue
    try {
      const st = statSync(full)
      if (st.size <= SEARCH_MAX_FILE_BYTES) out.push({ path: full, mtimeMs: st.mtimeMs, size: st.size })
    } catch {
      // unreadable — skip
    }
  }
}

export interface KbSearchHit {
  relativePath: string
  absolutePath: string
  score: number
  matchedTerms: string[]
  lines: Array<{ line: number; text: string }>
}

/**
 * Search KB text files. Plain mode: whitespace-separated terms, case-insensitive, files
 * ranked by distinct terms matched (filename hits weigh more). `regex=true` treats the
 * query as one JS regular expression.
 */
export function searchKb(
  snapshot: KbSnapshot,
  args: { query: string; scope?: string; regex?: boolean; limit?: number },
): { ok: true; scope: string; scannedFiles: number; totalMatches: number; hits: KbSearchHit[] } {
  const root = requireRoot(snapshot)
  const query = args.query.trim()
  if (!query) throw new Error('query is empty')
  const scopeArg = args.scope?.trim() || 'all'
  const scopes = scopeArg.split(/[,\s]+/).filter(Boolean)
  const dirs = scopes.includes('all')
    ? [root]
    : scopes.map(scope => resolveKbReadPath(snapshot, scope).absolutePath)

  /** `test(lower, raw)`: plain terms match the lower-cased text, regex the raw text. */
  let matchers: Array<{ term: string; test: (lower: string, raw: string) => boolean }>
  if (args.regex) {
    let re: RegExp
    try {
      re = new RegExp(query, 'i')
    } catch (error) {
      throw new Error(`invalid regex: ${error instanceof Error ? error.message : String(error)}`)
    }
    matchers = [{ term: query, test: (_lower, raw) => re.test(raw) }]
  } else {
    const terms = [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))]
    matchers = terms.map(term => ({ term, test: (lower: string) => lower.includes(term) }))
  }

  const files: Array<{ path: string; mtimeMs: number; size: number }> = []
  const seen = new Set<string>()
  for (const dir of dirs) {
    const st = statSync(dir)
    const batch: typeof files = []
    if (st.isFile()) batch.push({ path: dir, mtimeMs: st.mtimeMs, size: st.size })
    else walkTextFiles(dir, batch)
    for (const file of batch) {
      if (seen.has(file.path)) continue
      seen.add(file.path)
      files.push(file)
    }
  }

  const hits: KbSearchHit[] = []
  for (const file of files) {
    let cached: CachedFile
    try {
      cached = cachedText(file.path, file.mtimeMs, file.size)
    } catch {
      continue
    }
    const rel = toPosix(relative(root, file.path))
    const matched = new Set<string>()
    let score = 0
    for (const m of matchers) {
      if (m.test(rel.toLowerCase(), rel)) {
        matched.add(m.term)
        score += 3
      }
    }
    // Whole-file pre-filter: only split/scan lines of files that contain a term.
    const inBody = matchers.filter(m => m.test(cached.lower, cached.text))
    if (inBody.length === 0 && matched.size === 0) continue
    const lines: Array<{ line: number; text: string }> = []
    const rows = inBody.length > 0 ? cached.text.split(/\r\n?|\n/) : []
    let lineHits = 0
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]!
      const lower = row.toLowerCase()
      let lineHit = false
      for (const m of inBody) {
        if (m.test(lower, row)) {
          matched.add(m.term)
          lineHit = true
        }
      }
      if (!lineHit) continue
      lineHits += 1
      if (lines.length < SEARCH_HITS_PER_FILE) {
        const trimmed = row.trim()
        lines.push({ line: i + 1, text: trimmed.length > 240 ? `${trimmed.slice(0, 240)}…` : trimmed })
      }
    }
    // Distinct terms dominate; hit volume only breaks ties so big manuals don't swamp RCAs.
    score += matched.size * 10 + Math.min(lineHits, 30) * 0.1
    hits.push({
      relativePath: rel,
      absolutePath: file.path,
      score: Math.round(score * 10) / 10,
      matchedTerms: [...matched],
      lines,
    })
  }
  hits.sort((a, b) => b.score - a.score || a.relativePath.localeCompare(b.relativePath))
  const limit = Math.min(Math.max(Math.floor(args.limit ?? 20), 1), 100)
  return { ok: true, scope: scopeArg, scannedFiles: files.length, totalMatches: hits.length, hits: hits.slice(0, limit) }
}
