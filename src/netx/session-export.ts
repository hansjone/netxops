/**
 * Bulk session-log export for Ops: pack every durable session on this Host
 * into one ZIP for offline HQ analysis. Soft-depends on sessionPersistence
 * (JSONL raw artifacts); live sessions are flushed when a SessionStore is present.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir, hostname as osHostname } from 'node:os'
import { join } from 'node:path'
import { strToU8, zipSync, Zip, ZipDeflate } from 'fflate'
import type { Context } from '@deepseek-ai/cordis'
import {
  NETXOPS_SESSIONS_EXPORT_PATH,
  type SessionsExportStatus,
} from '../session-export-shared.ts'

export { NETXOPS_SESSIONS_EXPORT_PATH }
export type { SessionsExportStatus }

/** Default DEFLATE level for each ZIP entry. */
const COMPRESSION_LEVEL = 6

/** How many code units of artifact text one zip push carries. */
const PUSH_CHUNK_CODE_UNITS = 1 << 16

/** Subdir under `$DSH_HOME` where Ops bulk exports land. */
export const SESSIONS_EXPORT_DIRNAME = 'exports'

/** Duck-typed SessionPersistence surface used by export (no hard dep on dsh-session). */
export interface SessionPersistenceExportApi {
  readonly supportsRawArtifacts: boolean
  list: (signal?: AbortSignal) => Promise<readonly SessionExportHeader[]>
  readRaw: (
    id: string,
    signal?: AbortSignal,
  ) => Promise<SessionExportRawArtifact | undefined>
}

/** Minimal durable session header fields copied into the export manifest. */
export interface SessionExportHeader {
  readonly id: string
  readonly version: number
  readonly createdAt: number
  readonly cwd?: string
  readonly parentSession?: string
  readonly origin?: string
  readonly agentPreset?: string
  readonly delegationDepth?: number
}

/** One verbatim persistence artifact. */
export interface SessionExportRawArtifact {
  readonly meta: SessionExportHeader
  readonly filename: string
  readonly content: string
}

/** Optional live SessionStore flush barrier. */
interface SessionStoreFlushApi {
  get?: (id: string) => unknown
  flush?: (session: unknown) => Promise<void>
}

/** One exported file inside the bulk archive. */
type ZipTextEntry = { readonly path: string; readonly content: string }

/** Result of writing the bulk archive under `$DSH_HOME/exports`. */
export interface SessionsExportDiskResult {
  readonly path: string
  readonly filename: string
  readonly exportDir: string
  readonly sessionCountListed: number
  readonly sessionCountIncluded: number
  readonly sessionCountSkipped: number
  readonly bytes: number
}

/** Harness home used for sessions + exports. */
export function resolveDshHome(): string {
  const fromEnv = process.env.DSH_HOME?.trim()
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv
  return join(homedir(), '.dsh')
}

/**
 * Resolve sessionPersistence from the host context when the web profile mounted it.
 * @param ctx - cordis host context.
 */
export function resolveSessionPersistence(ctx: Context): SessionPersistenceExportApi | undefined {
  const fromGet = typeof (ctx as { get?: (name: string) => unknown }).get === 'function'
    ? (ctx as { get: (name: string) => unknown }).get('sessionPersistence')
    : undefined
  const persistence = (fromGet
    ?? (ctx as { sessionPersistence?: SessionPersistenceExportApi }).sessionPersistence) as
    | SessionPersistenceExportApi
    | undefined
  if (!persistence || typeof persistence.list !== 'function' || typeof persistence.readRaw !== 'function') {
    return undefined
  }
  return persistence
}

/**
 * Resolve the optional live session store for flush-before-read.
 * @param ctx - cordis host context.
 */
function resolveSessionStore(ctx: Context): SessionStoreFlushApi | undefined {
  const fromGet = typeof (ctx as { get?: (name: string) => unknown }).get === 'function'
    ? (ctx as { get: (name: string) => unknown }).get('sessions')
    : undefined
  const sessions = (fromGet ?? (ctx as { sessions?: SessionStoreFlushApi }).sessions) as
    | SessionStoreFlushApi
    | undefined
  if (!sessions || typeof sessions.get !== 'function' || typeof sessions.flush !== 'function') {
    return undefined
  }
  return sessions
}

/**
 * Preflight: whether bulk export can run and how many sessions would ship.
 * @param ctx - cordis host context.
 * @param signal - optional cancellation.
 */
export async function getSessionsExportStatus(
  ctx: Context,
  signal?: AbortSignal,
): Promise<SessionsExportStatus> {
  const persistence = resolveSessionPersistence(ctx)
  if (!persistence) {
    return {
      available: false,
      sessionCount: 0,
      supportsRawArtifacts: false,
      reason: 'sessionPersistence unavailable — mount a JSONL session backend (web profile default)',
    }
  }
  if (!persistence.supportsRawArtifacts) {
    return {
      available: false,
      sessionCount: 0,
      supportsRawArtifacts: false,
      reason: 'persistence backend does not expose per-session raw artifacts (SQLite export unsupported)',
    }
  }
  try {
    const headers = await persistence.list(signal)
    signal?.throwIfAborted()
    return {
      available: true,
      sessionCount: headers.length,
      supportsRawArtifacts: true,
    }
  } catch (error) {
    return {
      available: false,
      sessionCount: 0,
      supportsRawArtifacts: true,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Sanitize one path segment for ZIP entry names.
 * @param id - raw session id or hostname fragment.
 */
export function safePathSegment(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, '_')
}

/**
 * Browser download filename for a bulk export.
 * @param exportedAt - Date used for the timestamp stamp.
 * @param host - optional host label (defaults to os.hostname()).
 */
export function sessionsExportZipFilename(exportedAt: Date = new Date(), host = osHostname()): string {
  const stamp = [
    exportedAt.getUTCFullYear(),
    String(exportedAt.getUTCMonth() + 1).padStart(2, '0'),
    String(exportedAt.getUTCDate()).padStart(2, '0'),
    '-',
    String(exportedAt.getUTCHours()).padStart(2, '0'),
    String(exportedAt.getUTCMinutes()).padStart(2, '0'),
    String(exportedAt.getUTCSeconds()).padStart(2, '0'),
  ].join('')
  return `dsh-sessions-${safePathSegment(host)}-${stamp}.zip`
}

async function flushLiveSession(
  sessions: SessionStoreFlushApi | undefined,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted()
  if (!sessions?.get || !sessions.flush) return
  const live = sessions.get(id)
  if (live === undefined || live === null) return
  await sessions.flush(live)
  signal?.throwIfAborted()
}

/**
 * Yield ZIP text entries: manifest first, then each session artifact under sessions/<id>/.
 * Missing artifacts are recorded in the manifest and skipped (fail-soft for Ops pickup).
 * @param ctx - cordis host context.
 * @param signal - cancellation.
 */
export async function* sessionsExportEntries(
  ctx: Context,
  signal?: AbortSignal,
): AsyncGenerator<ZipTextEntry> {
  const persistence = resolveSessionPersistence(ctx)
  if (!persistence) {
    throw new Error('sessionPersistence unavailable')
  }
  if (!persistence.supportsRawArtifacts) {
    throw new Error('persistence backend does not expose per-session raw artifacts')
  }
  const sessions = resolveSessionStore(ctx)
  const headers = await persistence.list(signal)
  signal?.throwIfAborted()

  const exportedAt = new Date().toISOString()
  const host = osHostname()
  const included: Array<{
    id: string
    path: string
    createdAt: number
    cwd?: string
    agentPreset?: string
    parentSession?: string
    origin?: string
  }> = []
  const skipped: Array<{ id: string; reason: string }> = []
  const artifactEntries: ZipTextEntry[] = []

  for (const header of headers) {
    signal?.throwIfAborted()
    const id = String(header.id)
    try {
      await flushLiveSession(sessions, id, signal)
      const raw = await persistence.readRaw(id, signal)
      signal?.throwIfAborted()
      if (raw === undefined) {
        skipped.push({ id, reason: 'no stored artifact' })
        continue
      }
      const filename = raw.filename && raw.filename.length > 0 ? raw.filename : 'session.jsonl'
      const path = `sessions/${safePathSegment(id)}/${filename}`
      artifactEntries.push({ path, content: raw.content })
      included.push({
        id,
        path,
        createdAt: header.createdAt,
        cwd: header.cwd,
        agentPreset: header.agentPreset,
        parentSession: header.parentSession !== undefined ? String(header.parentSession) : undefined,
        origin: header.origin,
      })
    } catch (error) {
      skipped.push({
        id,
        reason: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const manifest = {
    kind: 'dsh-netxops-sessions-export',
    version: 1,
    exportedAt,
    hostname: host,
    sessionCountListed: headers.length,
    sessionCountIncluded: included.length,
    sessionCountSkipped: skipped.length,
    sessions: included,
    skipped,
  }
  yield {
    path: 'manifest.json',
    content: `${JSON.stringify(manifest, null, 2)}\n`,
  }
  for (const entry of artifactEntries) {
    signal?.throwIfAborted()
    yield entry
  }
}

/**
 * Push artifact text into a deflate stream in bounded chunks without splitting
 * surrogate pairs (lone high surrogates would corrupt UTF-8 as U+FFFD).
 */
async function pushArtifactChunks(
  deflate: ZipDeflate,
  content: string,
  signal: AbortSignal,
): Promise<void> {
  const encoder = new TextEncoder()
  let offset = 0
  let finalChunk: boolean
  do {
    signal.throwIfAborted()
    let end = Math.min(offset + PUSH_CHUNK_CODE_UNITS, content.length)
    if (end < content.length && end - offset > 1) {
      const last = content.charCodeAt(end - 1)
      if (last >= 0xd800 && last <= 0xdbff) end -= 1
    }
    finalChunk = end >= content.length
    deflate.push(encoder.encode(content.slice(offset, end)), finalChunk)
    offset = end
  } while (!finalChunk)
}

/**
 * Stream the bulk sessions ZIP as a WHATWG ReadableStream.
 * @param ctx - cordis host context.
 * @param signal - request / consumer cancellation.
 */
export function streamSessionsExportZip(
  ctx: Context,
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  const consumerAbort = new AbortController()
  const producerSignal = AbortSignal.any([signal, consumerAbort.signal])
  let zip: Zip | undefined
  let zipTerminated = false
  const terminateZip = (): void => {
    if (zip === undefined || zipTerminated) return
    zipTerminated = true
    zip.terminate()
  }
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const archive = new Zip((error, data, final) => {
        if (error) {
          controller.error(error)
          return
        }
        if (data.byteLength > 0) controller.enqueue(data)
        if (final) controller.close()
      })
      zip = archive
      void (async () => {
        try {
          for await (const entry of sessionsExportEntries(ctx, producerSignal)) {
            const deflate = new ZipDeflate(entry.path, { level: COMPRESSION_LEVEL })
            archive.add(deflate)
            await pushArtifactChunks(deflate, entry.content, producerSignal)
          }
          archive.end()
        } catch (error) {
          terminateZip()
          controller.error(error instanceof Error ? error : new Error(String(error)))
        }
      })()
    },
    cancel(reason) {
      consumerAbort.abort(
        reason instanceof Error ? reason : new Error('sessions export stream cancelled'),
      )
      terminateZip()
    },
  })
}

/**
 * Write every durable session into `$DSH_HOME/exports/<filename>.zip`.
 * This is the Ops-primary path: the absolute file location is returned so
 * operators can copy the archive off the Host without relying on the browser
 * download manager (which often swallows programmatic `<a download>` clicks).
 * @param ctx - cordis host context.
 * @param signal - optional cancellation.
 */
export async function writeSessionsExportZip(
  ctx: Context,
  signal?: AbortSignal,
): Promise<SessionsExportDiskResult> {
  const status = await getSessionsExportStatus(ctx, signal)
  if (!status.available) {
    throw new Error(status.reason ?? 'sessions export unavailable')
  }
  const files: Record<string, Uint8Array> = {}
  let included = 0
  let skipped = 0
  let listed = 0
  for await (const entry of sessionsExportEntries(ctx, signal)) {
    files[entry.path] = strToU8(entry.content)
    if (entry.path === 'manifest.json') {
      try {
        const manifest = JSON.parse(entry.content) as {
          sessionCountListed?: number
          sessionCountIncluded?: number
          sessionCountSkipped?: number
        }
        listed = typeof manifest.sessionCountListed === 'number' ? manifest.sessionCountListed : 0
        included = typeof manifest.sessionCountIncluded === 'number' ? manifest.sessionCountIncluded : 0
        skipped = typeof manifest.sessionCountSkipped === 'number' ? manifest.sessionCountSkipped : 0
      } catch {
        // Manifest parse is best-effort; ZIP still ships.
      }
    }
  }
  const zipped = zipSync(files, { level: COMPRESSION_LEVEL })
  const exportDir = join(resolveDshHome(), SESSIONS_EXPORT_DIRNAME)
  mkdirSync(exportDir, { recursive: true })
  const filename = sessionsExportZipFilename()
  const path = join(exportDir, filename)
  writeFileSync(path, zipped)
  return {
    path,
    filename,
    exportDir,
    sessionCountListed: listed || status.sessionCount,
    sessionCountIncluded: included,
    sessionCountSkipped: skipped,
    bytes: zipped.byteLength,
  }
}

/**
 * Build the HTTP Response for GET /api/netxops.sessions.export.
 * HEAD should use {@link sessionsExportHeadResponse} so listing does not start ZIP work.
 * @param ctx - cordis host context.
 * @param request - incoming fetch request.
 */
export async function sessionsExportResponse(
  ctx: Context,
  request: Request,
): Promise<Response> {
  const status = await getSessionsExportStatus(ctx, request.signal)
  if (!status.available) {
    return new Response(status.reason ?? 'sessions export unavailable', {
      status: status.supportsRawArtifacts === false && status.reason?.includes('raw artifacts')
        ? 501
        : 500,
    })
  }
  const filename = sessionsExportZipFilename()
  const body = streamSessionsExportZip(ctx, request.signal)
  return new Response(body, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${filename}"`,
      'x-netxops-session-count': String(status.sessionCount),
    },
  })
}

/**
 * Build the HTTP Response for HEAD /api/netxops.sessions.export (preflight only).
 * @param ctx - cordis host context.
 * @param request - incoming fetch request.
 */
export async function sessionsExportHeadResponse(
  ctx: Context,
  request: Request,
): Promise<Response> {
  const status = await getSessionsExportStatus(ctx, request.signal)
  if (!status.available) {
    return new Response(null, {
      status: status.supportsRawArtifacts === false && status.reason?.includes('raw artifacts')
        ? 501
        : 500,
      headers: {
        'x-netxops-export-error': status.reason ?? 'sessions export unavailable',
      },
    })
  }
  const filename = sessionsExportZipFilename()
  return new Response(null, {
    status: 200,
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${filename}"`,
      'x-netxops-session-count': String(status.sessionCount),
    },
  })
}
