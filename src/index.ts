/**
 * Host-plane Netx Ops bridge: settings (apiUrl / lang / python) + credentials
 * (NETX_API_TOKEN) drive a dynamically mounted `@deepseek-ai/dsh-mcp-client`.
 *
 * On activate, the agent preset + skills are copied into
 * `$DSH_HOME/.agent-presets/netxops` so `dsh plugin add` alone is enough
 * (Windows junctions are invisible to DSH's `Dirent.isDirectory()` scan).
 *
 * @module dsh-netxops
 */

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context, Fiber } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-credentials'
import * as DshSettings from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-settings'
import * as McpClient from '@deepseek-ai/dsh-mcp-client'

/** Cordis plugin name. */
export const name = 'netxops'

/** MCP tools registry must exist to mount the child client. */
export const inject = ['tools']

/** Settings / composition namespace (Plugins page join key). */
export const NETXOPS_SETTINGS_NAMESPACE = 'netxops'

/** Agent preset id under `$DSH_HOME/.agent-presets/`. */
export const NETXOPS_PRESET_ID = 'netxops'

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
  /**
   * Copy bundled agent preset + skills into `$DSH_HOME/.agent-presets/netxops`
   * on every activate (required for Settings → Agent presets).
   */
  installAgentPreset: boolean
}

export const Config: z<Config> = z.object({
  apiUrl: z.string().default('http://127.0.0.1:8890'),
  lang: z.string().default('zh'),
  pythonCommand: z.string().default('python'),
  tokenCredentialRef: z.string().role('credential-ref').default(DEFAULT_TOKEN_REF),
  toolCallTimeoutMs: z.number().step(1).min(1000).default(120_000),
  failOnStartupError: z.boolean().default(false),
  installAgentPreset: z.boolean().default(true),
})

/** Package root (parent of `lib/` or `src/` depending on launch). */
function packageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..')
}

/** Harness home used by agent-presets' user root. */
function resolveDshHome(): string {
  const fromEnv = process.env.DSH_HOME?.trim()
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv
  return join(homedir(), '.dsh')
}

/**
 * Install the bundled Netx Ops preset as a real directory under the user
 * preset root. DSH discovery skips Windows junctions (`Dirent.isDirectory()`
 * is false for reparse points), so a copy is required — not `mklink /J`.
 * @param logger - cordis logger for non-fatal install failures.
 */
export function ensureAgentPresetInstalled(logger: Context['logger']): void {
  const src = join(packageRoot(), 'presets', NETXOPS_PRESET_ID)
  const composition = join(src, 'agent.cordis.yml')
  if (!existsSync(composition)) {
    logger.warn('netxops: bundled preset missing at %s — skip user-preset install', src)
    return
  }
  const destParent = join(resolveDshHome(), '.agent-presets')
  const dest = join(destParent, NETXOPS_PRESET_ID)
  try {
    mkdirSync(destParent, { recursive: true })
    if (existsSync(dest)) {
      rmSync(dest, { recursive: true, force: true })
    }
    cpSync(src, dest, { recursive: true })
    writeFileSync(join(dest, '.dsh-netxops-managed'), `${new Date().toISOString()}\n`, 'utf8')
    logger.info('netxops: agent preset installed at %s', dest)
  } catch (error) {
    logger.error('netxops: failed to install agent preset: %s', error)
  }
}

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
 * Register the settings namespace on both dsh generations:
 * - 0.1.1-rc.2: standalone `installSettingsSection`
 * - ≥0.1.2-rc.1: `settings.installSection` on the provider
 */
function installNetxopsSettings(
  ctx: Context,
  entry: Config,
  hooks: {
    setSource: (current: () => Config) => void
    onChange: () => void
  },
): void {
  const legacy = (DshSettings as {
    installSettingsSection?: (
      context: Context,
      ns: string,
      schema: z<Config>,
      base: Config,
      sectionHooks: typeof hooks,
    ) => void
  }).installSettingsSection
  if (typeof legacy === 'function') {
    legacy(ctx, NETXOPS_SETTINGS_NAMESPACE, Config, entry, hooks)
    return
  }

  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, NETXOPS_SETTINGS_NAMESPACE, Config, entry, hooks)
  })
}

/**
 * Apply the Netx Ops host bridge.
 */
export function apply(ctx: Context, config: Config = Config({})): void {
  let source: () => Config = () => config
  let mcpFiber: Fiber | undefined
  let remounting: Promise<void> = Promise.resolve()
  let generation = 0

  if (config.installAgentPreset) {
    ensureAgentPresetInstalled(ctx.logger)
  }

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

  remount()

  installNetxopsSettings(ctx, config, {
    setSource: (current) => {
      source = current
    },
    onChange: () => {
      remount()
    },
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
