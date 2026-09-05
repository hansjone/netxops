/**
 * Host-plane Netx Ops: settings (apiUrl / lang / alarm push) + credentials
 * (NETX_API_TOKEN) publish a connection snapshot; the Ops preset mounts
 * `netx__*` into its own tool scope (`dsh-netxops/tools`).
 *
 * When「关键告警推送」is on, this host dials out to netx's fixed-IP alarm hub and
 * opens/follows a sticky DSH session (im / WhatsApp is optional and separate).
 *
 * @module dsh-netxops
 */

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-credentials'
import * as DshSettings from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-settings'
import { startAlarmPushClient } from './netx/alarm-push.ts'
import {
  getAlarmPushStatus,
  publishAlarmPushStatus,
  resetAlarmPushStatus,
} from './netx/alarm-push-status.ts'
import { deliverAlarmToSession, resetAlarmSession } from './netx/alarm-session.ts'
import { publishNetxConnection } from './netx/runtime.ts'

/** Cordis plugin name. */
export const name = 'netxops'

/** Wait for the credentials store before publishing a Bearer snapshot. */
export const inject = ['credentials']

/** Connection RPC channel for browser status reads. */
export const NETXOPS_RPC_CHANNEL = '/netxops'

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
  /** Passed as `lang` query when starting with `en`. */
  lang: string
  /** Credential reference for the bearer token (never store the secret here). */
  tokenCredentialRef: string
  /** Per tool-call timeout (ms). */
  toolCallTimeoutMs: number
  /**
   * Copy bundled agent preset + skills into `$DSH_HOME/.agent-presets/netxops`
   * on every activate (required for Settings → Agent presets).
   */
  installAgentPreset: boolean
  /**
   * Dial out to netx `/v1/integrations/dsh-alarm/ws` and deliver matched key
   * alarms into a sticky DSH session.
   */
  alarmPushEnabled: boolean
}

export const Config: z<Config> = z.object({
  apiUrl: z.string().default('http://127.0.0.1:8890'),
  lang: z.string().default('zh'),
  tokenCredentialRef: z.string().role('credential-ref').default(DEFAULT_TOKEN_REF),
  toolCallTimeoutMs: z.number().step(1).min(1000).default(120_000),
  installAgentPreset: z.boolean().default(true),
  alarmPushEnabled: z.boolean().default(false),
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
 * Requires `inject: ['credentials']` so the store is live before apply.
 */
async function resolveToken(ctx: Context, refName: string): Promise<string> {
  const hit = await ctx.credentials.resolve(credentialRef(refName))
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
 * Apply the Netx Ops host bridge (settings + connection publish + optional alarm push).
 */
export function apply(ctx: Context, config: Config = Config({})): void {
  let source: () => Config = () => config
  let publishing: Promise<void> = Promise.resolve()
  let generation = 0
  let stopAlarmPush: (() => void) | undefined

  if (config.installAgentPreset) {
    ensureAgentPresetInstalled(ctx.logger)
  }

  const restartAlarmPush = (apiUrl: string, token: string, enabled: boolean, lang: string): void => {
    stopAlarmPush?.()
    stopAlarmPush = undefined
    resetAlarmSession()
    if (!enabled) {
      resetAlarmPushStatus()
      return
    }
    if (!token.trim()) {
      ctx.logger.warn('netxops alarm-push: enabled but token is empty — not connecting')
      publishAlarmPushStatus({
        phase: 'error',
        enabled: true,
        wsUrl: '',
        detail: 'missing_token',
        lastError: 'token empty',
      })
      return
    }
    stopAlarmPush = startAlarmPushClient({
      apiUrl,
      token,
      logger: ctx.logger,
      onAlarm: (payload) => deliverAlarmToSession(ctx, payload, lang),
    })
  }

  const publish = (): void => {
    publishing = publishing.then(async () => {
      const gen = ++generation
      const current = source()
      const token = await resolveToken(ctx, current.tokenCredentialRef)
      if (gen !== generation) return

      const apiUrl = current.apiUrl.replace(/\/$/, '')
      const tokenConfigured = token.trim().length > 0
      publishNetxConnection({
        apiUrl,
        token,
        lang: current.lang,
        toolCallTimeoutMs: current.toolCallTimeoutMs,
      })
      restartAlarmPush(apiUrl, token, current.alarmPushEnabled === true, current.lang)
      if (!tokenConfigured) {
        ctx.logger.warn(
          'netxops: published connection → %s tokenConfigured=false (set credential %s)',
          apiUrl,
          current.tokenCredentialRef,
        )
      } else {
        ctx.logger.info(
          'netxops: published connection → %s tokenConfigured=true alarmPush=%s',
          apiUrl,
          current.alarmPushEnabled === true,
        )
      }
    }).catch((error) => {
      ctx.logger.error('netxops: connection publish error: %s', error)
    })
  }

  publish()

  installNetxopsSettings(ctx, config, {
    setSource: (current) => {
      source = current
    },
    onChange: () => {
      publish()
    },
  })

  ctx.on('credentials/reference-updated', (ref) => {
    if (String(ref) === source().tokenCredentialRef) publish()
  })

  // Browser card polls alarm-push WSS status through Connection RPC.
  ctx.inject(['connection'], (connCtx) => {
    const rpc = connCtx.connection?.rpc
    if (!rpc || typeof rpc.handle !== 'function') {
      connCtx.logger.warn('netxops: connection.rpc.handle unavailable — alarm status UI disabled')
      return
    }
    connCtx.effect(() => {
      const dispose = rpc.handle(
        NETXOPS_RPC_CHANNEL,
        async (endpoint: string) => {
          if (endpoint !== 'alarm-push.status') {
            return { ok: false, error: { code: 'bad-request', message: 'Unknown endpoint.' } }
          }
          return { ok: true, value: getAlarmPushStatus() }
        },
      )
      return () => { void dispose() }
    }, 'netxops: alarm-push status rpc')
  })

  ctx.effect(() => () => {
    generation += 1
    stopAlarmPush?.()
    stopAlarmPush = undefined
    resetAlarmSession()
    resetAlarmPushStatus()
  }, 'netxops: dispose host bridge')
}
