/**
 * Host-side tools for writing under MANIFEST `paths.local`
 * (memories / drafts / suggestions / refs). Bypasses workspace sandbox.
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { KbSnapshot } from './kb-manifest.ts'
import {
  createDraft,
  createMemory,
  createRef,
  createSuggestion,
  deleteLocalFile,
  listLocalFiles,
  updateLocalFile,
} from './kb-local-ops.ts'
import { kbLocalToolsEnabled, resolveKbLocalRoot, type RefArea } from './kb-local-path.ts'
import { getKbContext } from './kb-runtime.ts'
import { toLosslessJson } from './json-safe.ts'

const str = (description?: string) => ({ type: 'string' as const, ...(description ? { description } : {}) })
const bool = (description?: string) => ({ type: 'boolean' as const, ...(description ? { description } : {}) })
const num = (description?: string) => ({ type: 'number' as const, ...(description ? { description } : {}) })
const reqStr = (description?: string) => ({
  type: 'string' as const,
  required: true as const,
  ...(description ? { description } : {}),
})

function renderJson(_args: unknown, value: unknown) {
  return [{ type: 'text' as const, text: JSON.stringify(value, null, 0) }]
}

const jsonOut = {
  schema: { type: 'json' as const },
  render: renderJson,
}

function liveSnapshot(): KbSnapshot {
  return getKbContext()
}

function tool(
  name: string,
  description: string,
  /** DSH `defineTool` expects a flat parameter map — not a full JSON Schema object. */
  parameters: Record<string, unknown>,
  execute: (args: Record<string, unknown>) => Promise<unknown> | unknown,
) {
  return defineTool({
    name,
    description,
    parameters: parameters as never,
    output: jsonOut,
    timeoutMs: 30_000,
    isConcurrencySafe: () => false,
    async execute(args) {
      try {
        return toLosslessJson(await execute(args as Record<string, unknown>))
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : String(error))
      }
    },
  })
}

/**
 * Register KB local create/update/delete/list tools when snapshot has paths.local.
 * @returns disposer (no-op when disabled).
 */
export function registerKbLocalTools(
  ctx: Context,
  snapshot: KbSnapshot = getKbContext(),
): () => void {
  if (!kbLocalToolsEnabled(snapshot)) return () => {}

  const localRoot = resolveKbLocalRoot(snapshot)!
  const toolsApi = (ctx as { tools?: { register: (t: unknown) => () => void } }).tools
  if (!toolsApi || typeof toolsApi.register !== 'function') return () => {}

  const entries = [
    tool(
      'netx__kbWriteMemory',
      `Create (or overwrite) one diary-style memory markdown under ${localRoot}/memories/. `
        + 'bucket: note→日常笔记, rca_review→排障复盘, ai_trace→AI思维链. '
        + 'Default create-only; set overwrite=true to replace same filename. '
        + 'Do not use workspace Write — KB is outside the sandbox.',
      {
        bucket: {
          type: 'string' as const,
          required: true as const,
          enum: ['note', 'rca_review', 'ai_trace'],
          description: 'Memory subdirectory',
        },
        slug: reqStr('Short filename stem (no path separators)'),
        body: reqStr('Full markdown body'),
        date: str('Optional YYYY-MM-DD (default today)'),
        overwrite: bool('Replace if the target file already exists'),
      },
      (args) => createMemory(liveSnapshot(), {
        bucket: args.bucket as 'note' | 'rca_review' | 'ai_trace',
        slug: String(args.slug ?? ''),
        body: String(args.body ?? ''),
        date: args.date != null ? String(args.date) : undefined,
        overwrite: args.overwrite === true,
      }),
    ),
    tool(
      'netx__kbWriteDraft',
      `Create (or overwrite) a DRAFT case under ${localRoot}/drafts/. `
        + 'Filename is forced to DRAFT-YYYYMMDD-…; body gets status: draft frontmatter if missing. '
        + 'Set overwrite=true to replace. Not for formal RCA.',
      {
        slug: reqStr('Case stem (DRAFT- prefix added if missing)'),
        body: reqStr('Markdown body (RCA-ish draft)'),
        domain: str('Optional fault-domain subfolder under drafts/'),
        date: str('Optional event date YYYY-MM-DD or YYYYMMDD'),
        overwrite: bool('Replace if the target file already exists'),
      },
      (args) => createDraft(liveSnapshot(), {
        slug: String(args.slug ?? ''),
        body: String(args.body ?? ''),
        domain: args.domain != null ? String(args.domain) : undefined,
        date: args.date != null ? String(args.date) : undefined,
        overwrite: args.overwrite === true,
      }),
    ),
    tool(
      'netx__kbWriteSuggestion',
      `Create (or overwrite) a suggestion under ${localRoot}/suggestions/{theory|improvement}/. `
        + 'Use for HQ pack/theory corrections or tool/process improvements.',
      {
        kind: {
          type: 'string' as const,
          required: true as const,
          enum: ['theory', 'improvement'],
          description: 'theory = knowledge fix; improvement = tools/skills/process',
        },
        slug: reqStr('Short filename stem'),
        body: reqStr('Full markdown body'),
        date: str('Optional YYYY-MM-DD (default today)'),
        overwrite: bool('Replace if the target file already exists'),
      },
      (args) => createSuggestion(liveSnapshot(), {
        kind: args.kind as 'theory' | 'improvement',
        slug: String(args.slug ?? ''),
        body: String(args.body ?? ''),
        date: args.date != null ? String(args.date) : undefined,
        overwrite: args.overwrite === true,
      }),
    ),
    tool(
      'netx__kbWriteRef',
      `Create (or overwrite) site product-knowledge under ${localRoot}/refs/. `
        + 'area=inventory|devices|topology|business|commands|handbooks. '
        + 'For devices: require device=host_name; default slug PROFILE for the ops profile. '
        + 'Use for NE ledger, per-device profiles, topology/business notes, site command books — not diaries.',
      {
        area: {
          type: 'string' as const,
          required: true as const,
          enum: ['inventory', 'devices', 'topology', 'business', 'commands', 'handbooks'],
          description: 'refs/ subtree',
        },
        slug: reqStr('Filename stem (e.g. PROFILE, neighbors, ledger)'),
        body: reqStr('Full markdown body'),
        device: str('Required when area=devices — host_name (never UUID)'),
        overwrite: bool('Replace if the target file already exists'),
      },
      (args) => createRef(liveSnapshot(), {
        area: args.area as RefArea,
        slug: String(args.slug ?? ''),
        body: String(args.body ?? ''),
        device: args.device != null ? String(args.device) : undefined,
        overwrite: args.overwrite === true,
      }),
    ),
    tool(
      'netx__kbUpdateLocal',
      `Replace the body of an existing file under memories|drafts|suggestions|refs `
        + `(absolute path or path relative to ${localRoot}). `
        + 'Drafts keep status: draft.',
      {
        path: reqStr('Absolute path or path relative to KB local root'),
        body: reqStr('New full markdown body'),
      },
      (args) => updateLocalFile(liveSnapshot(), {
        path: String(args.path ?? ''),
        body: String(args.body ?? ''),
      }),
    ),
    tool(
      'netx__kbDeleteLocal',
      `Delete one existing markdown under memories|drafts|suggestions|refs `
        + `(absolute or relative to ${localRoot}).`,
      {
        path: reqStr('Absolute path or path relative to KB local root'),
      },
      (args) => deleteLocalFile(liveSnapshot(), {
        path: String(args.path ?? ''),
      }),
    ),
    tool(
      'netx__kbListLocal',
      `List recent .md files under ${localRoot} memories|drafts|suggestions|refs (newest first). `
        + 'Read contents via absolute paths from the listing.',
      {
        root: {
          type: 'string' as const,
          enum: ['memories', 'drafts', 'suggestions', 'refs', 'all'],
          description: 'Subtree to list (default all writable)',
        },
        limit: num('Max entries 1–200 (default 50)'),
      },
      (args) => listLocalFiles(liveSnapshot(), {
        root: (args.root as 'memories' | 'drafts' | 'suggestions' | 'refs' | 'all' | undefined) ?? 'all',
        limit: typeof args.limit === 'number' ? args.limit : undefined,
      }),
    ),
  ]

  const disposers = entries.map((entry) => toolsApi.register(entry))
  ctx.logger.info(
    'netxops: kb local tools registered count=%s localRoot=%s',
    disposers.length,
    localRoot,
  )
  return () => {
    for (const dispose of disposers) dispose()
  }
}
