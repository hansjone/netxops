/**
 * Filesystem ops for KB local writable trees (create / update / delete / list).
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import type { KbSnapshot } from './kb-manifest.ts'
import {
  draftDir,
  draftFileName,
  memoryDir,
  memoryFileName,
  resolveExistingWritableFile,
  resolveKbLocalRoot,
  resolveWritableLocalPath,
  suggestionDir,
  suggestionFileName,
  type MemoryBucket,
  type SuggestionKind,
  KB_LOCAL_WRITABLE_ROOTS,
  type KbLocalWritableRoot,
} from './kb-local-path.ts'

export type KbLocalWriteResult = {
  ok: true
  action: 'created' | 'updated' | 'deleted'
  absolutePath: string
  relativePath: string
}

export type KbLocalListEntry = {
  absolutePath: string
  relativePath: string
  mtimeMs: number
  size: number
}

function requireLocalRoot(snapshot: KbSnapshot): string {
  const root = resolveKbLocalRoot(snapshot)
  if (!root) {
    throw new Error('KB local root unavailable (configure kbRoot + MANIFEST paths.local)')
  }
  return root
}

function ensureDraftBody(body: string): string {
  const trimmed = body.replace(/^\uFEFF/, '')
  if (/^---\r?\n[\s\S]*?\r?\nstatus:\s*draft\b/m.test(trimmed)
    || /^---\r?\n[\s\S]*?\nstatus:\s*["']?draft["']?\s*$/m.test(trimmed)) {
    return trimmed.endsWith('\n') ? trimmed : `${trimmed}\n`
  }
  // Prepend minimal frontmatter when missing.
  if (trimmed.startsWith('---')) {
    const end = trimmed.indexOf('\n---', 3)
    if (end !== -1) {
      const fm = trimmed.slice(0, end + 4)
      const rest = trimmed.slice(end + 4)
      if (/\nstatus:\s*/.test(fm)) return trimmed.endsWith('\n') ? trimmed : `${trimmed}\n`
      const injected = fm.replace(/^---\r?\n/, '---\nstatus: draft\n')
      const out = `${injected}${rest}`
      return out.endsWith('\n') ? out : `${out}\n`
    }
  }
  return `---\nstatus: draft\n---\n\n${trimmed.endsWith('\n') ? trimmed : `${trimmed}\n`}`
}

export function createMemory(
  snapshot: KbSnapshot,
  args: {
    bucket: MemoryBucket
    slug: string
    body: string
    date?: string
    overwrite?: boolean
  },
): KbLocalWriteResult {
  const localRoot = requireLocalRoot(snapshot)
  const name = memoryFileName({ date: args.date, slug: args.slug })
  const target = resolveWritableLocalPath(localRoot, memoryDir(args.bucket), name)
  if (existsSync(target.absolutePath) && !args.overwrite) {
    throw new Error(
      `file already exists (pass overwrite=true to replace): ${target.relativePath}`,
    )
  }
  mkdirSync(dirname(target.absolutePath), { recursive: true })
  const existed = existsSync(target.absolutePath)
  writeFileSync(
    target.absolutePath,
    args.body.endsWith('\n') ? args.body : `${args.body}\n`,
    'utf8',
  )
  return {
    ok: true,
    action: existed ? 'updated' : 'created',
    absolutePath: target.absolutePath,
    relativePath: target.relativePath,
  }
}

export function createDraft(
  snapshot: KbSnapshot,
  args: {
    slug: string
    body: string
    domain?: string
    date?: string
    overwrite?: boolean
  },
): KbLocalWriteResult {
  const localRoot = requireLocalRoot(snapshot)
  const name = draftFileName({ date: args.date, slug: args.slug })
  const target = resolveWritableLocalPath(localRoot, draftDir(args.domain), name)
  if (existsSync(target.absolutePath) && !args.overwrite) {
    throw new Error(
      `file already exists (pass overwrite=true to replace): ${target.relativePath}`,
    )
  }
  mkdirSync(dirname(target.absolutePath), { recursive: true })
  const existed = existsSync(target.absolutePath)
  writeFileSync(target.absolutePath, ensureDraftBody(args.body), 'utf8')
  return {
    ok: true,
    action: existed ? 'updated' : 'created',
    absolutePath: target.absolutePath,
    relativePath: target.relativePath,
  }
}

export function createSuggestion(
  snapshot: KbSnapshot,
  args: {
    kind: SuggestionKind
    slug: string
    body: string
    date?: string
    overwrite?: boolean
  },
): KbLocalWriteResult {
  const localRoot = requireLocalRoot(snapshot)
  const name = suggestionFileName({ date: args.date, slug: args.slug })
  const target = resolveWritableLocalPath(localRoot, suggestionDir(args.kind), name)
  if (existsSync(target.absolutePath) && !args.overwrite) {
    throw new Error(
      `file already exists (pass overwrite=true to replace): ${target.relativePath}`,
    )
  }
  mkdirSync(dirname(target.absolutePath), { recursive: true })
  const existed = existsSync(target.absolutePath)
  writeFileSync(
    target.absolutePath,
    args.body.endsWith('\n') ? args.body : `${args.body}\n`,
    'utf8',
  )
  return {
    ok: true,
    action: existed ? 'updated' : 'created',
    absolutePath: target.absolutePath,
    relativePath: target.relativePath,
  }
}

/**
 * Replace body of an existing file under memories|drafts|suggestions.
 * Drafts keep/force `status: draft` in frontmatter.
 */
export function updateLocalFile(
  snapshot: KbSnapshot,
  args: { path: string; body: string },
): KbLocalWriteResult {
  const localRoot = requireLocalRoot(snapshot)
  const target = resolveExistingWritableFile(localRoot, args.path)
  if (!existsSync(target.absolutePath)) {
    throw new Error(`file not found: ${target.relativePath}`)
  }
  const body = target.writableRoot === 'drafts'
    ? ensureDraftBody(args.body)
    : (args.body.endsWith('\n') ? args.body : `${args.body}\n`)
  writeFileSync(target.absolutePath, body, 'utf8')
  return {
    ok: true,
    action: 'updated',
    absolutePath: target.absolutePath,
    relativePath: target.relativePath,
  }
}

export function deleteLocalFile(
  snapshot: KbSnapshot,
  args: { path: string },
): KbLocalWriteResult {
  const localRoot = requireLocalRoot(snapshot)
  const target = resolveExistingWritableFile(localRoot, args.path)
  if (!existsSync(target.absolutePath)) {
    throw new Error(`file not found: ${target.relativePath}`)
  }
  rmSync(target.absolutePath, { force: false })
  return {
    ok: true,
    action: 'deleted',
    absolutePath: target.absolutePath,
    relativePath: target.relativePath,
  }
}

function walkFiles(dir: string, baseLocal: string, out: KbLocalListEntry[]): void {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (name === '.' || name === '..') continue
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      walkFiles(full, baseLocal, out)
    } else if (st.isFile() && name.toLowerCase().endsWith('.md')) {
      const rel = full.slice(baseLocal.length).replace(/^[/\\]/, '').split(/[/\\]/).join('/')
      out.push({
        absolutePath: full,
        relativePath: rel,
        mtimeMs: st.mtimeMs,
        size: st.size,
      })
    }
  }
}

export function listLocalFiles(
  snapshot: KbSnapshot,
  args: {
    root?: KbLocalWritableRoot | 'all'
    limit?: number
  } = {},
): { ok: true; localRoot: string; entries: KbLocalListEntry[] } {
  const localRoot = requireLocalRoot(snapshot)
  const roots: KbLocalWritableRoot[] = args.root && args.root !== 'all'
    ? [args.root]
    : [...KB_LOCAL_WRITABLE_ROOTS]
  const entries: KbLocalListEntry[] = []
  for (const r of roots) {
    walkFiles(join(localRoot, r), localRoot, entries)
  }
  entries.sort((a, b) => b.mtimeMs - a.mtimeMs)
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 200)
  return {
    ok: true,
    localRoot,
    entries: entries.slice(0, limit),
  }
}

/** Read a local writable file (optional helper for tests). */
export function readLocalFile(snapshot: KbSnapshot, pathArg: string): string {
  const localRoot = requireLocalRoot(snapshot)
  const target = resolveExistingWritableFile(localRoot, pathArg)
  return readFileSync(target.absolutePath, 'utf8')
}
