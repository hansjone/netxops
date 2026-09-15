/**
 * Path jail for operator-subset `_local` agent writes.
 * Writable trees: memories / drafts / suggestions only (not identity / local_skills).
 */

import { existsSync, realpathSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import type { KbSnapshot } from './kb-manifest.ts'

/** Top-level dirs under paths.local that agents may create/update/delete. */
export const KB_LOCAL_WRITABLE_ROOTS = Object.freeze([
  'memories',
  'drafts',
  'suggestions',
] as const)

export type KbLocalWritableRoot = (typeof KB_LOCAL_WRITABLE_ROOTS)[number]

export type MemoryBucket = 'note' | 'rca_review' | 'ai_trace'
export type SuggestionKind = 'theory' | 'improvement'

export const MEMORY_BUCKET_DIR: Readonly<Record<MemoryBucket, string>> = Object.freeze({
  note: '日常笔记',
  rca_review: '排障复盘',
  ai_trace: 'AI思维链',
})

/**
 * Absolute `paths.local` root, or null when KB not configured / field missing.
 */
export function resolveKbLocalRoot(snapshot: KbSnapshot): string | null {
  if (snapshot.status !== 'configured') return null
  const rel = snapshot.paths.local?.trim()
  if (!rel) return null
  return resolve(snapshot.realRoot, rel)
}

/** True when local write tools should register. */
export function kbLocalToolsEnabled(snapshot: KbSnapshot): boolean {
  return resolveKbLocalRoot(snapshot) !== null
}

/**
 * Sanitize a slug for filenames: strip path separators, keep CJK / alnum / ._- .
 */
export function sanitizeSlug(raw: string, fallback = 'entry'): string {
  const cleaned = raw
    .trim()
    .replace(/[/\\]+/g, '-')
    .replace(/\.\.+/g, '')
    .replace(/[^\w.\u4e00-\u9fff-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned || fallback
}

/** Today's date as YYYY-MM-DD (local). */
export function todayIsoDate(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Compact YYYYMMDD from ISO date or today. */
export function toCompactDate(isoOrEmpty?: string, now = new Date()): string {
  const iso = (isoOrEmpty?.trim() || todayIsoDate(now)).replace(/-/g, '')
  if (!/^\d{8}$/.test(iso)) {
    throw new Error(`invalid date (want YYYY-MM-DD or YYYYMMDD): ${isoOrEmpty}`)
  }
  return iso
}

function normalizeIsoDate(raw?: string, now = new Date()): string {
  const t = raw?.trim()
  if (!t) return todayIsoDate(now)
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  if (/^\d{8}$/.test(t)) {
    return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`
  }
  throw new Error(`invalid date (want YYYY-MM-DD or YYYYMMDD): ${raw}`)
}

export function memoryFileName(opts: {
  date?: string
  slug: string
  now?: Date
}): string {
  const date = normalizeIsoDate(opts.date, opts.now)
  return `${date}-${sanitizeSlug(opts.slug)}.md`
}

export function draftFileName(opts: {
  date?: string
  slug: string
  now?: Date
}): string {
  const compact = toCompactDate(opts.date, opts.now)
  const slug = sanitizeSlug(opts.slug)
  const base = slug.toUpperCase().startsWith('DRAFT-') ? slug : `DRAFT-${compact}-${slug}`
  return base.toLowerCase().endsWith('.md') ? base : `${base}.md`
}

export function suggestionFileName(opts: {
  date?: string
  slug: string
  now?: Date
}): string {
  const date = normalizeIsoDate(opts.date, opts.now)
  return `${date}-${sanitizeSlug(opts.slug)}.md`
}

/**
 * Resolve a candidate path and assert it lies under a writable local subtree.
 * Parent dirs need not exist yet (create path); uses resolve + prefix check.
 */
export function resolveWritableLocalPath(
  localRoot: string,
  ...segments: string[]
): { absolutePath: string; relativePath: string; writableRoot: KbLocalWritableRoot } {
  if (segments.some((s) => s.includes('\0'))) {
    throw new Error('path segment contains NUL')
  }
  const absolutePath = resolve(localRoot, ...segments)
  const rel = relative(localRoot, absolutePath)
  if (!rel || rel.startsWith('..') || rel.split(/[/\\]/).includes('..')) {
    throw new Error(`path escapes local root: ${absolutePath}`)
  }
  const top = rel.split(/[/\\]/)[0] as string
  if (!(KB_LOCAL_WRITABLE_ROOTS as readonly string[]).includes(top)) {
    throw new Error(
      `writes only allowed under ${KB_LOCAL_WRITABLE_ROOTS.join('|')}/ (got ${top}/)`,
    )
  }
  return {
    absolutePath,
    relativePath: rel.split(sep).join('/'),
    writableRoot: top as KbLocalWritableRoot,
  }
}

/**
 * Resolve an existing file path (absolute or relative to localRoot) inside the jail.
 */
export function resolveExistingWritableFile(
  localRoot: string,
  pathArg: string,
): { absolutePath: string; relativePath: string; writableRoot: KbLocalWritableRoot } {
  const trimmed = pathArg.trim()
  if (!trimmed) throw new Error('path is empty')
  const candidate = resolve(trimmed)
  // Prefer absolute if it already sits under localRoot; else treat as relative.
  let absolutePath: string
  const localResolved = resolve(localRoot)
  const underLocal =
    candidate === localResolved
    || candidate.startsWith(localResolved + sep)
  if (underLocal) {
    absolutePath = candidate
  } else {
    absolutePath = resolve(localRoot, trimmed)
  }
  const checked = resolveWritableLocalPath(
    localRoot,
    ...relative(localRoot, absolutePath).split(/[/\\]/).filter(Boolean),
  )
  // Prefer realpath when the file (or a parent) exists, to defeat symlink escapes.
  try {
    if (existsSync(checked.absolutePath)) {
      const realFile = realpathSync(checked.absolutePath)
      const realLocal = realpathSync(localRoot)
      const realRel = relative(realLocal, realFile)
      if (!realRel || realRel.startsWith('..') || realRel.split(/[/\\]/).includes('..')) {
        throw new Error(`path escapes local root after realpath: ${realFile}`)
      }
      const top = realRel.split(/[/\\]/)[0]!
      if (!(KB_LOCAL_WRITABLE_ROOTS as readonly string[]).includes(top)) {
        throw new Error(`path not under writable roots: ${realRel}`)
      }
      if (!statSync(realFile).isFile()) {
        throw new Error(`not a file: ${realFile}`)
      }
      return {
        absolutePath: realFile,
        relativePath: realRel.split(sep).join('/'),
        writableRoot: top as KbLocalWritableRoot,
      }
    }
  } catch (error) {
    if (error instanceof Error && /escapes|writable|not a file/.test(error.message)) {
      throw error
    }
  }
  return checked
}

export function memoryDir(bucket: MemoryBucket): string {
  return join('memories', MEMORY_BUCKET_DIR[bucket])
}

export function suggestionDir(kind: SuggestionKind): string {
  return join('suggestions', kind)
}

export function draftDir(domain?: string): string {
  const d = domain?.trim()
  if (!d) return 'drafts'
  return join('drafts', sanitizeSlug(d, 'misc'))
}
