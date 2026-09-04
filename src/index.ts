/**
 * Host-plane Netx Ops bridge: settings (apiUrl / lang / python) + credentials
 * (NETX_API_TOKEN) drive a dynamically mounted `@deepseek-ai/dsh-mcp-client`.
 *
 * Configure in DSH Settings → Plugins → Netx Ops (settings card when client
 * half is installed). Token is stored as credential `NETX_API_TOKEN` (same
 * store as model API keys). Helper: `scripts/set-netx-token.ps1`.
 *
 * @module dsh-netxops
 */

import type { Context, Fiber } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-settings'
import * as McpClient from '@deepseek-ai/dsh-mcp-client'

/** Cordis plugin name. */
export const name = 'netxops'

/** MCP tools registry must exist to mount the child client. */
export const inject = ['tools']

/** Settings / composition namespace (Plugins page join key). */
export const NETXOPS_SETTINGS_NAMESPACE = 'netxops'

/** Default credential reference for the netx API bearer token. */
export const DEFAULT_TOKEN_REF = 'NETX_API_TOKEN'

/** Plugin / settings section shape. */
export interface Config {
  /** netx REST root (no trailing slash required). */
  apiUrl: string
  /** Passed to MCP as `NETX_LANG`. */
  lang: string
  /** Executable that can run `python -m netx_mcp`. */
  pythonCommand: string
  /** Credential reference for the bearer token (never store the secret here). */
  tokenCredentialRef: string
  /** Per MCP tool-call timeout (ms). */
  toolCallTimeoutMs: number
  /** Fail activation when MCP cannot connect / sync tools. */
  failOnStartupError: boolean
}

export const Config: z<Config> = z.object({
  apiUrl: z.string().default('http://127.0.0.1:8890'),
  lang: z.string().default('zh'),
  pythonCommand: z.string().default('python'),
  tokenCredentialRef: z.string().role('credential-ref').default(DEFAULT_TOKEN_REF),
  toolCallTimeoutMs: z.number().step(1).min(1000).default(120_000),
  failOnStartupError: z.boolean().default(false),
})

/**
 * Resolve bearer token from the credentials seam (or empty when unset).
 */
async function resolveToken(ctx: Context, refName: string): Promise<string> {
  const credentials = ctx.get('credentials')
  if (credentials === undefined) return ''
  const hit = await credentials.resolve(credentialRef(refName))
  return hit?.value ?? ''
}

/**
 * Apply the Netx Ops host bridge.
 */
export function apply(ctx: Context, config: Config = Config({})): void {
  let source: () => Config = () => config
  let mcpFiber: Fiber | undefined
  let remounting: Promise<void> = Promise.resolve()
  let generation = 0

  const remount = (): void => {
    remounting = remounting.then(async () => {
      const gen = ++generation
      const previous = mcpFiber
      mcpFiber = undefined
      if (previous !== undefined) {
        try {
          await previous.dispose()
        } catch (error) {
          ctx.logger.warn('netxops: disposing previous mcp-client failed: %s', error)
        }
      }
      if (gen !== generation) return

      const current = source()
      const token = await resolveToken(ctx, current.tokenCredentialRef)
      if (gen !== generation) return

      const mcpConfig = McpClient.Config({
        transport: 'stdio',
        serverName: 'netx',
        command: current.pythonCommand,
        args: ['-m', 'netx_mcp'],
        env: {
          NETX_API_URL: current.apiUrl.replace(/\/$/, ''),
          NETX_API_TOKEN: token,
          NETX_LANG: current.lang,
        },
        toolCallTimeoutMs: current.toolCallTimeoutMs,
        failOnStartupError: current.failOnStartupError,
      })

      try {
        mcpFiber = await ctx.plugin(McpClient, mcpConfig)
      } catch (error) {
        ctx.logger.error('netxops: failed to mount mcp-client: %s', error)
        if (current.failOnStartupError) throw error
      }
    }).catch((error) => {
      ctx.logger.error('netxops: remount error: %s', error)
    })
  }

  // Composition defaults first (works even when settings provider is absent).
  remount()

  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, NETXOPS_SETTINGS_NAMESPACE, Config, config, {
      setSource: (current) => {
        source = current
      },
      onChange: () => {
        remount()
      },
    })
  })

  ctx.on('credentials/reference-updated', (ref) => {
    if (String(ref) === source().tokenCredentialRef) remount()
  })

  ctx.effect(() => () => {
    generation += 1
    const fiber = mcpFiber
    mcpFiber = undefined
    void fiber?.dispose()
  }, 'netxops: dispose mcp-client')
}
