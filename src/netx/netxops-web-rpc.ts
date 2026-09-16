/**
 * Mount `/netxops/*` on the plugin's own `webServer` inject (DSH ≥0.1.5).
 *
 * `connection.rpc.handle('/netxops')` registers via the connection plugin ctx,
 * which no longer injects `webServer` — the route never mounts and the settings
 * card sees HTTP 405 → "未配置". Same pattern as dsh-pocket `web-rpc.js`.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'

/** Max buffered JSON body for control-plane RPC (status / kb.resolve paths). */
const NETXOPS_RPC_BODY_MAX = 8 * 1024 * 1024

const ENDPOINT_SEGMENT_PATTERN = /^[A-Za-z0-9_$.-]+$/
const INVALID_REQUEST_RPC_ID = 'invalid-request'
const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1'])

export type NetxopsRpcHandler = (
  endpoint: string,
  payload: unknown,
  signal: AbortSignal,
) => Promise<unknown>

function endpointFromPath(channel: string, pathname: string): string | undefined {
  if (!pathname.startsWith(`${channel}/`)) return undefined
  const endpoint = pathname.slice(channel.length + 1)
  if (endpoint.split('/').some((seg) =>
    seg === '' || seg === '.' || seg === '..' || !ENDPOINT_SEGMENT_PATTERN.test(seg))) {
    return undefined
  }
  return endpoint
}

function serverResponseJson(rpcId: string, result: unknown): string {
  return JSON.stringify({ type: 'server-response', rpcId, result })
}

function isTrustedLoopbackRequest(req: IncomingMessage): boolean {
  const host = req.headers?.host
  if (!host) return false
  const hostName = host.split(':')[0]
  if (!LOOPBACK_HOSTNAMES.has(hostName ?? '')) return false
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function netxopsFetchHandler(
  channel: string,
  handler: NetxopsRpcHandler,
  log: Pick<Context['logger'], 'error'>,
) {
  return {
    async fetch(request: Request): Promise<Response> {
      const endpoint = endpointFromPath(channel, new URL(request.url).pathname)
      if (request.method !== 'POST' || endpoint === undefined) {
        return new Response('not found', { status: 404 })
      }
      const mediaType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
      if (mediaType !== 'application/json') {
        return new Response('content type must be application/json', { status: 415 })
      }
      let body: unknown
      try {
        body = await request.json()
      } catch {
        return new Response('body is not JSON', { status: 400 })
      }
      const row = body as { rpcId?: unknown; method?: unknown; payload?: unknown } | null
      const rpcId = row && typeof row.rpcId === 'string' ? row.rpcId : INVALID_REQUEST_RPC_ID
      const method = row && typeof row.method === 'string' ? row.method : null
      if (rpcId === INVALID_REQUEST_RPC_ID || method === null) {
        return new Response(
          serverResponseJson(INVALID_REQUEST_RPC_ID, {
            ok: false,
            error: { code: 'bad-request', message: 'invalid client-request message', details: { issues: [] } },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      if (method !== endpoint) {
        return new Response(
          serverResponseJson(rpcId, {
            ok: false,
            error: {
              code: 'bad-request',
              message: `method ${JSON.stringify(method)} does not match endpoint ${JSON.stringify(endpoint)}`,
              details: { issues: [] },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      try {
        const result = await handler(endpoint, row?.payload, request.signal)
        return new Response(serverResponseJson(rpcId, result), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      } catch (error) {
        log.error?.('netxops: rpc %s failed: %s', endpoint, error instanceof Error ? error.message : String(error))
        return new Response(`handler failure: ${String(error)}`, { status: 500 })
      }
    },
  }
}

async function httpBridge(
  req: IncomingMessage,
  res: ServerResponse,
  fetchHandler: { fetch: (request: Request) => Promise<Response> },
  maxBodyBytes: number,
): Promise<void> {
  const abort = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) abort.abort()
  })

  const declaredLen = req.headers['content-length']
  if (declaredLen !== undefined && Number(declaredLen) > maxBodyBytes) {
    res.writeHead(413, { connection: 'close' })
    res.end()
    req.destroy()
    return
  }
  const chunks: Buffer[] = []
  let received = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    received += buffer.byteLength
    if (received > maxBodyBytes) {
      res.writeHead(413, { connection: 'close' })
      res.end()
      req.destroy()
      return
    }
    chunks.push(buffer)
  }

  const url = `http://${req.headers.host ?? '127.0.0.1'}${req.url ?? '/'}`
  const request = new Request(url, {
    method: req.method ?? 'GET',
    headers: Object.fromEntries(
      Object.entries(req.headers).filter(([, value]) => typeof value === 'string') as [string, string][],
    ),
    ...chunks.length > 0 ? { body: Buffer.concat(chunks) } : {},
    signal: abort.signal,
  })

  const response = await fetchHandler.fetch(request)
  const headers = Object.fromEntries(response.headers.entries())
  res.writeHead(response.status, headers)
  if (response.body === null) {
    res.end()
    return
  }
  for await (const chunk of response.body) {
    if (!res.write(chunk)) {
      await new Promise<void>((resolve) => {
        const done = (): void => {
          res.off('drain', done)
          res.off('close', done)
          resolve()
        }
        res.once('drain', done)
        res.once('close', done)
      })
    }
  }
  res.end()
}

type ConnectionRejection = { requestRejection?: (req: IncomingMessage) => number | undefined }

/**
 * Register prefix route `channel` on `ctx.webServer` when available.
 * @returns disposer, or null when `webServer` is not on this inject ctx.
 */
export function mountNetxopsWebRoute(
  ctx: Context & { webServer?: { register: (route: unknown) => unknown }; connection?: ConnectionRejection },
  channel: string,
  handler: NetxopsRpcHandler,
): (() => void) | null {
  const webServer = ctx.webServer
  if (!webServer || typeof webServer.register !== 'function') return null

  const connection = ctx.connection
  const fetchHandler = netxopsFetchHandler(channel, handler, ctx.logger)
  const route = {
    kind: 'prefix' as const,
    path: channel,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      let rejection: number | undefined
      if (typeof connection?.requestRejection === 'function') {
        try {
          rejection = connection.requestRejection(req)
        } catch {
          rejection = 403
        }
      } else if (!isTrustedLoopbackRequest(req)) {
        rejection = 403
      }
      if (rejection !== undefined) {
        res.writeHead(rejection, { 'content-type': 'text/plain; charset=utf-8' })
        res.end(rejection === 401 ? 'unauthorized' : 'forbidden')
        return
      }
      await httpBridge(req, res, fetchHandler, NETXOPS_RPC_BODY_MAX)
    },
  }

  const registered = webServer.register(route)
  if (typeof registered === 'function') {
    return () => {
      try {
        registered()
      } catch {
        // already disposed
      }
    }
  }
  if (registered && typeof (registered as Promise<unknown>).then === 'function') {
    let done = false
    return () => {
      if (done) return
      done = true
      void (registered as Promise<(() => void) | void>).then((dispose) => {
        if (typeof dispose === 'function') dispose()
      }).catch(() => {})
    }
  }
  return () => {}
}
