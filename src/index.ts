/**
 * Host-plane Netx Ops: settings (apiUrl / lang / thinking+reply language /
 * alarm push / capability groups / optional knowledge-base root) + credentials
 * (NETX_API_TOKEN) publish a connection snapshot. Thinking / reply language
 * inject into Host `systemPrompt` and apply to **all** agent presets.
 *
 * When「关键告警推送」is on, this host dials out to netx's fixed-IP alarm hub and
 * opens/follows a sticky DSH session (im / WhatsApp is optional and separate).
 *
 * Ops can download every durable session on this Host as one ZIP
 * (`GET /api/netxops.sessions.export`) for HQ analysis — including cloud Hosts,
 * where the browser receives the archive.
 *
 * Knowledge base: settings `kbRoot` → locate/validate MANIFEST.json →
 * `process.env.KB_*` + dynamic `kb-context` + optional `_skills/kb-*` packs
 * (default Netx Ops preset; optional public). Unconfigured/error degrades to
 * pure netx (no invented operator).
 *
 * @module dsh-netxops
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-credentials'
import * as DshSettings from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-settings'
export {
  ensureAgentPresetInstalled,
  NETXOPS_PRESET_ID,
} from './agent-preset-install.ts'
export {
  mergeHostConfigForHeal,
  NETXOPS_HOST_CONFIG_DEFAULTS,
  writePatchIfUnchanged,
} from './netx/heal-profile-entry.ts'
export { normalizeApiUrl } from './netx/http.ts'
import { ensureAgentPresetInstalled, resolveActiveProfile } from './agent-preset-install.ts'
import { startAlarmPushClient } from './netx/alarm-push.ts'
import {
  getAlarmPushStatus,
  publishAlarmPushStatus,
  resetAlarmPushStatus,
} from './netx/alarm-push-status.ts'
import { dispatchAlarmToSinks } from './netx/alarm-dispatch.ts'
import { resetAlarmSession } from './netx/alarm-session.ts'
import {
  capabilityGroupsFromSettings,
  groupsForPlane,
  kbEnabledForPlane,
  type NetxCapabilityGroupSettingsFields,
} from './netx/capability-groups.ts'
import { registerGroupSkills } from './netx/group-skills.ts'
import { resolveImTargets } from './netx/im-targets.ts'
import { registerKbContextSkill } from './netx/kb-context-skill.ts'
import { resolveKbRoot } from './netx/kb-manifest.ts'
import { registerKbLocalTools } from './netx/kb-local-tools.ts'
import { registerKbPackSkills } from './netx/kb-pack-skills.ts'
import {
  applyKbEnv,
  getKbContext,
  publishKbContext,
  resetKbContext,
  watchKbContext,
} from './netx/kb-runtime.ts'
import {
  normalizeReplyLanguage,
  normalizeThinkingLanguage,
  readSystemLocalePreference,
  replyInstruction,
  replyReminder,
  resolveThinkingLanguage,
  thinkingInstruction,
  thinkingReminder,
} from './netx/model-language.ts'
import { normalizeApiUrl, type NormalizeApiUrlResult } from './netx/http.ts'
import { publishNetxConnection, getNetxConnection, watchNetxConnection } from './netx/runtime.ts'
import {
  getSessionsExportStatus,
  NETXOPS_SESSIONS_EXPORT_PATH,
  sessionsExportHeadResponse,
  sessionsExportResponse,
} from './netx/session-export.ts'
import { mountNetxopsWebRoute } from './netx/netxops-web-rpc.ts'
import {
  getToolMountStatus,
  getToolMountStatuses,
  publishToolMountStatus,
  resetToolMountStatus,
} from './netx/tool-mount-status.ts'
import { registerNetxTools } from './netx/tools.ts'
import { installPresetPublication } from './netx/preset-publication.ts'
import { readConfigSnapshot, readConfigValue, type ConfigInput } from './netx/config-values.ts'

// The event is absent from older peer declarations, where it is never emitted.
declare module '@deepseek-ai/cordis' {
  interface Events {
    'loader/volatile-update'(paths: readonly (readonly string[])[]): void
  }
}

/** Cordis plugin name. */
export const name = 'netxops'

/**
 * Hard-inject `tools` (trilium / official cookbook pattern). Soft `credentials`
 * previously left connection unpublished when pending; tools soft-inject could
 * also never fire — Host then registered zero `netx__*` globally. Credentials
 * stay soft below; we provisional-publish immediately.
 */
export const inject = ['tools']

/** Connection RPC channel for browser status reads. */
export const NETXOPS_RPC_CHANNEL = '/netxops'

/** Settings / composition namespace (Plugins page join key). */
export const NETXOPS_SETTINGS_NAMESPACE = 'netxops'

/** Default credential reference for the netx API bearer token. */
export const DEFAULT_TOKEN_REF = 'NETX_API_TOKEN'

/** Default tool-call timeout when settings omit / null the volatile field. */
export const DEFAULT_TOOL_CALL_TIMEOUT_MS = 120_000

/** Default REST root when settings projection emits null/empty for apiUrl. */
export const DEFAULT_API_URL = 'http://127.0.0.1:8890'

/** Default API lang query when settings projection emits null/empty for lang. */
export const DEFAULT_LANG = 'zh'

/** Plugin / settings section shape. */
export interface Config {
  /** Master switch for every Netx tool and skill publication. */
  toolsEnabled: boolean
  groupOpsPresets: string
  groupTopologyPresets: string
  groupBizMonitorPresets: string
  groupKbPresets: string
  /** netx REST root (no trailing slash required). */
  apiUrl: string
  /** Passed as `lang` query when starting with `en` (API + alarm copy only). */
  lang: string
  /**
   * Model thinking / chain-of-thought language for **all** presets on this Host.
   * `auto` follows DSH UI locale; otherwise `zh-CN` / `en`.
   */
  thinkingLanguage: string
  /**
   * Model final-reply language for **all** presets on this Host.
   * `follow-user` = no forced reply language; otherwise `zh` / `en`.
   */
  replyLanguage: string
  /** Credential reference for the bearer token (never store the secret here). */
  tokenCredentialRef: string
  /** Per tool-call timeout (ms). */
  toolCallTimeoutMs: number
  /**
   * Compose `$DSH_HOME/.agent-presets/netxops` from the host shipped
   * `standard` preset + Netx Ops persona/tools/skills (DSH has no preset
   * inheritance). Disable only if you manage that directory yourself.
   */
  installAgentPreset: boolean
  /**
   * Dial out to netx `/v1/integrations/dsh-alarm/ws` and deliver matched key
   * alarms into a sticky DSH session.
   */
  alarmPushEnabled: boolean
  /** When push is on, also followup the sticky Netx Ops DSH session (default). */
  alarmDeliverDsh: boolean
  /**
   * When push is on, also send via `ctx.dshIm.send` to every configured target.
   * Derived from selected sinks (`imTargets` / legacy pair); empty list means off.
   */
  alarmDeliverIm: boolean
  /**
   * JSON array of `{ botId, targetId }` sinks. Preferred over the legacy
   * single-target fields below when non-empty.
   */
  imTargets: string
  /** Opaque bot id from IM「投递设置」→ 复制调用参数 (legacy single-target). */
  imBotId: string
  /** Opaque target id from the same copy payload (legacy single-target). */
  imTargetId: string
  /**
   * NMS provider adapter id. Supported today: `zte-ume`
   * (REST `/v1/ume/*`; model tools are generic `netx__*Nms*`).
   */
  nmsProvider: string
  /** ops tools/skills in the Netx Ops preset (default on) — NMS + CLI + paths. */
  groupOpsInPreset: boolean
  /** Publish ops tools/skills to other presets (default off — Netx Ops only). */
  groupOpsPublic: boolean
  /** topology canvas / layout tools in the Netx Ops preset (default off). */
  groupTopologyInPreset: boolean
  /** Publish topology tools/skills to other presets (default off). */
  groupTopologyPublic: boolean
  /** biz-monitor (cutover / biz_state read) tools in the Netx Ops preset (default on). */
  groupBizMonitorInPreset: boolean
  /** Publish biz-monitor tools/skills to other presets (default off). */
  groupBizMonitorPublic: boolean
  /**
   * Absolute (or Host-local) path to an operator-subset knowledge package.
   * Empty = unconfigured. Plugin locates `MANIFEST.json` (≤3 levels) and
   * injects `KB_*` + `kb-context` skill + optional `_skills` packs.
   */
  kbRoot: string
  /** Mount subset `_skills/kb-*` into the Netx Ops preset (default on). */
  groupKbInPreset: boolean
  /** Publish subset `_skills/kb-*` to other presets (default off). */
  groupKbPublic: boolean
}

/**
 * DSH ≥0.1.7 / 0.2.0 only projects Config fields marked `.volatile()` into the
 * settings UI. Zero volatile fields → the whole entry is silently filtered.
 * Older schemastery without `volatile` keeps the bare schema (≤0.1.5 path).
 */
function vol<S>(schema: S): S {
  const candidate = schema as { volatile?: () => S }
  return typeof candidate.volatile === 'function' ? candidate.volatile() : schema
}

export const Config: z<Config, ConfigInput<Config>> = z.object({
  toolsEnabled: vol(z.boolean().default(true)),
  groupOpsPresets: vol(z.string().default('')),
  groupTopologyPresets: vol(z.string().default('')),
  groupBizMonitorPresets: vol(z.string().default('')),
  groupKbPresets: vol(z.string().default('')),
  apiUrl: vol(z.string().default('http://127.0.0.1:8890')),
  lang: vol(z.string().default('zh')),
  thinkingLanguage: vol(z.string().default('auto')),
  replyLanguage: vol(z.string().default('follow-user')),
  tokenCredentialRef: vol(z.string().role('credential-ref').default(DEFAULT_TOKEN_REF)),
  toolCallTimeoutMs: vol(z.number().step(1).min(1000).default(120_000)),
  installAgentPreset: vol(z.boolean().default(true)),
  alarmPushEnabled: vol(z.boolean().default(false)),
  alarmDeliverDsh: vol(z.boolean().default(true)),
  alarmDeliverIm: vol(z.boolean().default(false)),
  imTargets: vol(z.string().default('')),
  imBotId: vol(z.string().default('')),
  imTargetId: vol(z.string().default('')),
  nmsProvider: vol(z.string().default('zte-ume')),
  groupOpsInPreset: vol(z.boolean().default(true)),
  groupOpsPublic: vol(z.boolean().default(false)),
  groupTopologyInPreset: vol(z.boolean().default(false)),
  groupTopologyPublic: vol(z.boolean().default(false)),
  groupBizMonitorInPreset: vol(z.boolean().default(true)),
  groupBizMonitorPublic: vol(z.boolean().default(false)),
  kbRoot: vol(z.string().default('')),
  groupKbInPreset: vol(z.boolean().default(true)),
  groupKbPublic: vol(z.boolean().default(false)),
})

/** Merge settings projection without letting null/undefined wipe profile defaults. */
export function mergeConfigSkippingNullish(
  base: ConfigInput<Config>,
  patch: Record<string, unknown>,
): Config {
  const live = Object.fromEntries(
    Object.entries(readConfigSnapshot(patch)).filter(([, v]) => v !== null && v !== undefined),
  )
  return { ...readConfigSnapshot(base), ...live }
}

/** Positive finite timeout for `defineTool`; fall back when projection emits null. */
export function resolveToolCallTimeoutMs(
  value: unknown,
  fallback = DEFAULT_TOOL_CALL_TIMEOUT_MS,
): number {
  value = readConfigValue(value)
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

type ApiUrlNormalizeError = Extract<NormalizeApiUrlResult, { ok: false }>['error']

/** Heal null/empty lang from settings projection. */
export function resolveLang(value: unknown, fallback = DEFAULT_LANG): string {
  value = readConfigValue(value)
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

/**
 * Resolve a publishable apiUrl.
 * null/undefined/"" → default localhost; invalid non-empty → "" (keep warn path).
 */
export function resolveApiUrlForConnection(value: unknown): {
  url: string
  usedDefault: boolean
  error?: ApiUrlNormalizeError
} {
  value = readConfigValue(value)
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) {
    const normalized = normalizeApiUrl(DEFAULT_API_URL)
    return {
      url: normalized.ok ? normalized.url : DEFAULT_API_URL,
      usedDefault: true,
    }
  }
  const normalized = normalizeApiUrl(raw)
  if (normalized.ok) return { url: normalized.url, usedDefault: false }
  return { url: '', usedDefault: false, error: normalized.error }
}

function packageVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as { version?: string }
    return typeof pkg.version === 'string' ? pkg.version : '0'
  } catch {
    return '0'
  }
}

/** Heal null/empty/invalid tokenCredentialRef from settings projection. */
export function resolveTokenCredentialRef(value: unknown): string {
  value = readConfigValue(value)
  return typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value.trim())
    ? value.trim()
    : DEFAULT_TOKEN_REF
}

type CredentialsResolve = {
  resolve?: (ref: unknown) => Promise<{ value?: string } | undefined>
}

function credentialsFrom(ctx: Context): CredentialsResolve | undefined {
  const direct = (ctx as { credentials?: CredentialsResolve }).credentials
  if (direct && typeof direct.resolve === 'function') return direct
  if (typeof (ctx as { get?: (name: string) => unknown }).get === 'function') {
    const viaGet = (ctx as { get: (name: string) => unknown }).get('credentials') as CredentialsResolve | undefined
    if (viaGet && typeof viaGet.resolve === 'function') return viaGet
  }
  return undefined
}

/**
 * Resolve bearer token from the credentials seam (or env fallback).
 * Never throws — invalid/null ref names fall back to {@link DEFAULT_TOKEN_REF}.
 */
async function resolveToken(
  ctx: Context,
  refName: unknown,
  log?: { warn: (...args: unknown[]) => void },
): Promise<string> {
  const ref = resolveTokenCredentialRef(refName)
  const fromEnv = (): string => process.env[ref]?.trim() ?? ''
  try {
    const credentials = credentialsFrom(ctx)
    if (!credentials?.resolve) {
      const env = fromEnv()
      if (!env) log?.warn('netxops: credentials service unavailable; %s empty', ref)
      return env
    }
    const hit = await credentials.resolve(credentialRef(ref))
    const value = typeof hit?.value === 'string' ? hit.value.trim() : ''
    if (value) return value
    const env = fromEnv()
    if (!env) log?.warn('netxops: credential %s resolve returned empty', ref)
    return env
  } catch (error) {
    log?.warn('netxops: credential %s resolve failed: %s', ref, error)
    return fromEnv()
  }
}

/** Normalize settings.describe() across DSH generations (array or { namespaces }). */
function describeRows(describe: unknown): Array<{ ns?: string, value?: unknown }> {
  if (typeof describe !== 'function') return []
  try {
    const raw = (describe as () => unknown)()
    if (Array.isArray(raw)) return raw as Array<{ ns?: string, value?: unknown }>
    if (raw && typeof raw === 'object' && Array.isArray((raw as { namespaces?: unknown }).namespaces)) {
      return (raw as { namespaces: Array<{ ns?: string, value?: unknown }> }).namespaces
    }
  } catch {
    // describe can throw while the provider is settling
  }
  return []
}

/**
 * Register / follow the settings namespace across DSH generations:
 * - 0.1.1-rc.2: standalone `installSettingsSection`
 * - ≥0.1.2-rc.1: `settings.installSection` on the provider
 * - ≥0.1.7 / 0.2.0: Config is projected from the Loader entry; no owner scope —
 *   re-read via `settings.describe()` and poll for UI writes (no scope.watch).
 */
function installNetxopsSettings(
  ctx: Context,
  entry: ConfigInput<Config>,
  hooks: {
    setSource: (current: () => ConfigInput<Config>) => void
    onChange: () => void
  },
): void {
  const legacy = (DshSettings as {
    installSettingsSection?: (
      context: Context,
      ns: string,
      schema: z<Config, ConfigInput<Config>>,
      base: Config,
      sectionHooks: typeof hooks,
    ) => void
  }).installSettingsSection
  if (typeof legacy === 'function') {
    legacy(ctx, NETXOPS_SETTINGS_NAMESPACE, Config, readConfigSnapshot(entry), hooks)
    return
  }

  ctx.inject(['settings'], (settingsCtx) => {
    const settings = settingsCtx.settings as {
      installSection?: (
        context: Context,
        ns: string,
        schema: z<Config, ConfigInput<Config>>,
        base: Config,
        sectionHooks: typeof hooks,
      ) => void
      describe?: () => unknown
    }

    if (typeof settings.installSection === 'function') {
      settings.installSection(ctx, NETXOPS_SETTINGS_NAMESPACE, Config, readConfigSnapshot(entry), hooks)
      return
    }

    // DSH ≥0.1.7: profile Config projection — follow live fiber config.
    // `settings/document-updated` fires right after configForms save → remount
    // public tools/skills without restart (poll is a slow backup only).
    const readLive = (): Config => {
      const row = describeRows(settings.describe).find(item => item.ns === NETXOPS_SETTINGS_NAMESPACE)
      if (row?.value !== null && typeof row?.value === 'object' && !Array.isArray(row.value)) {
        // Settings projection may emit null for volatile scalars; never let null/undefined
        // wipe profile defaults (e.g. toolCallTimeoutMs → defineTool throw → zero tools).
        return mergeConfigSkippingNullish(entry, row.value as Record<string, unknown>)
      }
      return readConfigSnapshot(entry)
    }
    hooks.setSource(readLive)
    hooks.onChange()

    let lastFingerprint = JSON.stringify(readLive())
    const bumpIfChanged = (reason: string): void => {
      const next = readLive()
      const fingerprint = JSON.stringify(next)
      if (fingerprint === lastFingerprint) return
      lastFingerprint = fingerprint
      settingsCtx.logger.info('netxops: live settings changed (%s) → republish connection', reason)
      hooks.onChange()
    }

    settingsCtx.effect(() => {
      const onDocumentUpdated = (ns: string): void => {
        if (ns !== NETXOPS_SETTINGS_NAMESPACE && ns !== 'dsh-netxops') return
        bumpIfChanged('document-updated')
      }
      const off = settingsCtx.on('settings/document-updated', onDocumentUpdated)
      const timer = setInterval(() => { bumpIfChanged('poll') }, 2_000)
      return () => {
        clearInterval(timer)
        if (typeof off === 'function') off()
      }
    }, 'netxops: settings live follow')
    settingsCtx.logger.info(
      'netxops: hot-following settings (document-updated + describe poll)',
    )
  })
}

/**
 * Apply the Netx Ops host bridge (settings + connection publish + optional alarm push).
 */
export function apply(ctx: Context, config: ConfigInput<Config> = Config({} as Config)): void {
  let source: () => Config = () => readConfigSnapshot(config)
  const initial = source()
  let generation = 0
  let disposed = false
  let resolvedTokenRef = resolveTokenCredentialRef(initial.tokenCredentialRef)
  let stopAlarmPush: (() => void) | undefined
  /** Prefer the soft-injected credentials fiber — parent ctx may lack the service. */
  let credentialsCtx: Context = ctx

  if (initial.installAgentPreset) {
    const profile = resolveActiveProfile(ctx.baseUrl)
    let scheduled = false
    const fallback = setTimeout(() => {
      if (!scheduled && !disposed && source().installAgentPreset) {
        ensureAgentPresetInstalled(ctx.logger, profile)
      }
    }, 1000)
    ctx.inject(['agentPresets'], presetCtx => {
      scheduled = true
      clearTimeout(fallback)
      let active = true
      const timer = setTimeout(() => {
        void (async () => {
          const registry = presetCtx.get('agentPresets') as {
            readDocument?: (id: string) => Promise<{ content: string }>
          }
          let document: string | undefined
          try { document = (await registry.readDocument?.('standard'))?.content }
          catch (error) { presetCtx.logger.warn('netxops: cannot read Host standard preset: %s', error) }
          if (active && !disposed && source().installAgentPreset) {
            ensureAgentPresetInstalled(presetCtx.logger, profile, document)
          }
        })().catch(error => { presetCtx.logger.warn('netxops: preset installation failed: %s', error) })
      }, 0)
      presetCtx.effect(() => () => { active = false; clearTimeout(timer) }, 'netxops: Host standard composition')
    })
    ctx.effect(() => () => { clearTimeout(fallback) }, 'netxops: preset installation fallback')
  }

  const connectionSnapshot = (current: Config, token: string) => {
    const resolved = resolveApiUrlForConnection(current.apiUrl)
    if (resolved.error) {
      ctx.logger.warn(
        'netxops: invalid apiUrl (%s) — using empty url until fixed; use http(s) without embedded credentials',
        resolved.error,
      )
    } else if (resolved.usedDefault) {
      ctx.logger.warn(
        'netxops: apiUrl missing/null in settings — falling back to %s',
        resolved.url,
      )
    }
    return {
      toolsEnabled: current.toolsEnabled !== false,
      groupKbPresets: current.groupKbPresets ?? '',
      apiUrl: resolved.url,
      token,
      lang: resolveLang(current.lang),
      toolCallTimeoutMs: resolveToolCallTimeoutMs(current.toolCallTimeoutMs),
      groups: capabilityGroupsFromSettings(current as NetxCapabilityGroupSettingsFields),
      groupKbInPreset: typeof current.groupKbInPreset === 'boolean'
        ? current.groupKbInPreset
        : true,
      groupKbPublic: current.groupKbPublic === true,
    }
  }

  // Sync provisional publish BEFORE any async work so preset `dsh-netxops/tools`
  // can remount in the same tick (credentials resolve may take a while).
  const provisional = connectionSnapshot(initial, '')
  publishNetxConnection(provisional)
  installPresetPublication(ctx)
  ctx.logger.info(
    'netxops: provisional connection published → %s (token pending credentials)',
    provisional.apiUrl || '(invalid apiUrl)',
  )

  // Host-global tools FIRST (trilium pattern). Hard-inject guarantees tools;
  // smoke/unit may call apply without it — resolve via get() so a bare
  // `ctx.tools` access cannot throw "without inject". Register before settings
  // / credentials so a later soft-inject stall cannot leave the catalog empty.
  const toolsApi = (() => {
    try {
      const fromGet = typeof (ctx as { get?: (name: string) => unknown }).get === 'function'
        ? (ctx as { get: (name: string) => unknown }).get('tools')
        : undefined
      if (fromGet && typeof (fromGet as { register?: unknown }).register === 'function') {
        return fromGet as { register: (entry: unknown) => () => void }
      }
    } catch {
      // ignore
    }
    const direct = (ctx as { tools?: { register: (entry: unknown) => () => void } }).tools
    return direct && typeof direct.register === 'function' ? direct : undefined
  })()
  if (!toolsApi) {
    ctx.logger.warn(
      'netxops: tools missing on apply — host tool mount skipped (loader should inject tools)',
    )
    publishToolMountStatus({
      version: 'unknown',
      plane: 'host',
      groups: [],
      names: [],
      count: 0,
      at: new Date().toISOString(),
      error: 'tools service missing on host apply',
      source: 'host',
    })
  } else {
    let disposeToolsMount: (() => void) | undefined
    let disposeKbLocal: (() => void) | undefined
    const remountHostTools = (): void => {
      if (disposed) return
      disposeToolsMount?.()
      disposeToolsMount = undefined
      const connection = getNetxConnection()
      if (!connection) return
      const enabled = connection.toolsEnabled === false ? [] : groupsForPlane(connection.groups, 'host')
      // trilium-style: register inside ctx.effect so fiber teardown owns the mount
      disposeToolsMount = ctx.effect(() => {
        try {
          const unregister = registerNetxTools(ctx, connection, { plane: 'host' })
          ctx.logger.info(
            'netxops: host tools groups=[%s] count=%s',
            enabled.join(',') || '(none)',
            getToolMountStatus()?.count ?? 0,
          )
          return () => { unregister() }
        } catch (error) {
          publishToolMountStatus({
            version: packageVersion(),
            plane: 'host',
            groups: [...enabled],
            names: [],
            count: 0,
            at: new Date().toISOString(),
            error: String(error),
          })
          ctx.logger.error('netxops: host tools register failed: %s', error)
          return () => {}
        }
      }, 'netxops: host tools mount')
    }
    const remountKbLocal = (): void => {
      if (disposed) return
      disposeKbLocal?.()
      disposeKbLocal = undefined
      const connection = getNetxConnection()
      if (!connection) return
      // Host plane = public only (same rule as capability groups).
      if (!kbEnabledForPlane(connection, 'host')) return
      disposeKbLocal = ctx.effect(() => {
        const unregister = registerKbLocalTools(ctx, getKbContext(), { plane: 'host', source: 'netxops-host:kb-local' })
        return () => { unregister?.() }
      }, 'netxops: host kb-local tools')
    }
    const stopWatch = watchNetxConnection(() => {
      remountHostTools()
      remountKbLocal()
    })
    const stopKbWatch = watchKbContext(() => { remountKbLocal() })
    remountHostTools()
    remountKbLocal()
    ctx.effect(() => () => {
      stopWatch()
      stopKbWatch()
      disposeToolsMount?.()
      disposeKbLocal?.()
      resetToolMountStatus()
    }, 'netxops: dispose host tools')
  }

  const restartAlarmPush = (current: Config, apiUrl: string, token: string): void => {
    stopAlarmPush?.()
    stopAlarmPush = undefined
    resetAlarmSession()
    if (!current.alarmPushEnabled) {
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
    const lang = resolveLang(current.lang)
    const deliverDsh = current.alarmDeliverDsh !== false
    const imTargets = resolveImTargets({
      imTargets: current.imTargets ?? '',
      imBotId: current.imBotId ?? '',
      imTargetId: current.imTargetId ?? '',
    })
    // Prefer target list presence; UI also mirrors this into alarmDeliverIm.
    const deliverIm = imTargets.length > 0
    stopAlarmPush = startAlarmPushClient({
      apiUrl,
      token,
      logger: ctx.logger,
      onAlarm: async (payload) => {
        // Parallel sinks: a stuck/failing DSH sticky session must not block WhatsApp/IM.
        await dispatchAlarmToSinks(ctx, payload, {
          deliverDsh,
          deliverIm,
          imTargets,
          lang,
        })
      },
    })
  }

  const publish = (): void => {
    if (disposed) return
    const gen = ++generation
    // Sync publish first (reuse last token) so capability toggles remount in the
    // same tick — do not wait on credentials.resolve for group on/off.
    const currentSync = source()
    const previous = getNetxConnection()
    const sameCredential = resolveTokenCredentialRef(currentSync.tokenCredentialRef) === resolvedTokenRef
    const sameHost = resolveApiUrlForConnection(currentSync.apiUrl).url === previous?.apiUrl
    const prevToken = sameCredential && sameHost ? previous?.token ?? '' : ''
    publishNetxConnection(connectionSnapshot(currentSync, prevToken))
    const kb = resolveKbRoot(currentSync.kbRoot ?? '')
    publishKbContext(kb)
    applyKbEnv(kb)
    if (!currentSync.alarmPushEnabled) {
      stopAlarmPush?.()
      stopAlarmPush = undefined
      resetAlarmPushStatus()
    }

    void (async () => {
      const current = source()
      const tokenRef = resolveTokenCredentialRef(current.tokenCredentialRef)
      const token = await resolveToken(credentialsCtx, tokenRef, ctx.logger)
      if (disposed || gen !== generation) return
      resolvedTokenRef = tokenRef

      if (current.nmsProvider && current.nmsProvider !== 'zte-ume') {
        ctx.logger.warn(
          'netxops: nmsProvider=%s is not implemented yet; using zte-ume REST adapter',
          current.nmsProvider,
        )
      }
      const snapshot = connectionSnapshot(current, token)
      publishNetxConnection(snapshot)
      const kb = resolveKbRoot(current.kbRoot ?? '')
      publishKbContext(kb)
      applyKbEnv(kb)
      if (kb.status === 'configured') {
        ctx.logger.info(
          'netxops: knowledge base configured → %s (%s / %s v%s)',
          kb.realRoot,
          kb.operatorName,
          kb.country,
          kb.version,
        )
      } else if (kb.status === 'error') {
        ctx.logger.warn('netxops: knowledge base error — %s', kb.errorMessage)
      }
      restartAlarmPush(current, snapshot.apiUrl, token)
      const tokenConfigured = token.trim().length > 0
      if (!tokenConfigured) {
        ctx.logger.warn(
          'netxops: published connection → %s tokenConfigured=false (set credential %s)',
          snapshot.apiUrl,
          tokenRef,
        )
      } else {
        const imSinkCount = resolveImTargets({
          imTargets: current.imTargets ?? '',
          imBotId: current.imBotId ?? '',
          imTargetId: current.imTargetId ?? '',
        }).length
        ctx.logger.info(
          'netxops: published connection → %s tokenConfigured=true alarmPush=%s dsh=%s im=%s host=[%s]',
          snapshot.apiUrl,
          current.alarmPushEnabled === true,
          current.alarmDeliverDsh !== false,
          imSinkCount,
          groupsForPlane(snapshot.groups, 'host').join(',') || '(none)',
        )
      }
    })().catch((error) => {
      ctx.logger.error('netxops: connection publish error: %s', error)
    })
  }

  publish()

  // Current Loader commits volatile references in place and notifies this
  // owning fiber. Read them again and revoke/remount immediately on UI saves.
  ctx.on('loader/volatile-update', () => { publish() })

  installNetxopsSettings(ctx, config, {
    setSource: (current) => {
      source = () => readConfigSnapshot(current())
    },
    onChange: () => {
      publish()
    },
  })

  // Soft credentials — never block Host apply on this service.
  ctx.inject(['credentials'], (credCtx) => {
    credentialsCtx = credCtx
    publish()
    credCtx.on('credentials/reference-updated', (ref) => {
      if (String(ref) === resolveTokenCredentialRef(source().tokenCredentialRef)) publish()
    })
  })

  // Host-global model language: every preset on this Host inherits these
  // systemPrompt sections (not scoped to the Netx Ops agent preset).
  ctx.inject(['systemPrompt', 'settings'], (promptCtx) => {
    type PromptSurface = {
      section: (spec: { name: string, order: number, text: string | (() => string) }) => (() => void) | void
      context: (spec: { name: string, order: number, text: string | (() => string) }) => (() => void) | void
    }
    const systemPrompt = (promptCtx as { systemPrompt: PromptSurface }).systemPrompt
    /** Prefer live settings document over cordis base config (survives UI saves). */
    const liveConfig = (): Config => {
      const settings = promptCtx.get('settings') as {
        get?: (ns: string) => unknown
      } | undefined
      const section = typeof settings?.get === 'function'
        ? (() => {
          try {
            return settings.get!(NETXOPS_SETTINGS_NAMESPACE)
          } catch {
            return undefined
          }
        })()
        : undefined
      if (section !== null && typeof section === 'object' && !Array.isArray(section)) {
        return mergeConfigSkippingNullish(source(), section as Record<string, unknown>)
      }
      return source()
    }
    const effectiveThinking = (): ReturnType<typeof resolveThinkingLanguage> => {
      const settings = promptCtx.get('settings') as { get?: (ns: string) => unknown } | undefined
      const current = liveConfig()
      return resolveThinkingLanguage(
        normalizeThinkingLanguage(current.thinkingLanguage),
        readSystemLocalePreference(settings),
      )
    }
    const replySetting = (): string => normalizeReplyLanguage(liveConfig().replyLanguage)
    promptCtx.effect(() => {
      const disposers: Array<() => void> = []
      const push = (dispose: (() => void) | void): void => {
        if (typeof dispose === 'function') disposers.push(dispose)
      }
      push(systemPrompt.section({
        name: 'netxops:thinking-language',
        order: 85,
        text: () => thinkingInstruction(effectiveThinking()),
      }))
      push(systemPrompt.context({
        name: 'netxops:thinking-language-reminder',
        order: 1000,
        text: () => thinkingReminder(effectiveThinking()),
      }))
      // Late section + per-step context so reply language beats persona / user language.
      push(systemPrompt.section({
        name: 'netxops:reply-language',
        order: 10150,
        text: () => replyInstruction(replySetting()),
      }))
      push(systemPrompt.context({
        name: 'netxops:reply-language-reminder',
        order: 1100,
        text: () => replyReminder(replySetting()),
      }))
      promptCtx.logger.info(
        'netxops: model language prompts registered (thinking=%s reply=%s)',
        normalizeThinkingLanguage(liveConfig().thinkingLanguage),
        replySetting(),
      )
      return () => {
        for (const dispose of disposers.splice(0)) dispose()
      }
    }, 'netxops: model language prompts')
  })

  ctx.inject(['skills'], (skillsCtx) => {
    let skillAbort = new AbortController()
    let packAbort = new AbortController()
    let unregisterSkills: (() => void) | undefined
    let unregisterKbSkill: (() => void) | undefined
    let unregisterKbPack: (() => void) | undefined
    let generation = 0
    let packGeneration = 0
    const remountHostSkills = (): void => {
      if (disposed) return
      const gen = ++generation
      skillAbort.abort()
      skillAbort = new AbortController()
      unregisterSkills?.()
      unregisterSkills = undefined
      const connection = getNetxConnection()
      if (!connection) return
      const enabled = connection.toolsEnabled === false ? [] : groupsForPlane(connection.groups, 'host')
      void registerGroupSkills(skillsCtx, enabled, 'netxops-host', skillAbort.signal).then((dispose) => {
        if (gen !== generation) {
          dispose()
          return
        }
        unregisterSkills = dispose
        skillsCtx.logger.info(
          'netxops: host skills groups=[%s]',
          enabled.join(',') || '(none)',
        )
      }).catch((error) => {
        skillsCtx.logger.warn('netxops: host skill register failed: %s', error)
      })
    }
    const remountKbSkill = (): void => {
      if (disposed) return
      unregisterKbSkill?.()
      unregisterKbSkill = undefined
      const connection = getNetxConnection()
      if (!kbEnabledForPlane(connection, 'host')) return
      const snapshot = getKbContext()
      unregisterKbSkill = registerKbContextSkill(skillsCtx, snapshot)
      skillsCtx.logger.info(
        'netxops: kb-context skill status=%s (host/public)',
        snapshot.status,
      )
    }
    const remountKbPack = (): void => {
      if (disposed) return
      const gen = ++packGeneration
      packAbort.abort()
      packAbort = new AbortController()
      unregisterKbPack?.()
      unregisterKbPack = undefined
      const connection = getNetxConnection()
      const enabled = kbEnabledForPlane(connection, 'host') && Boolean(connection)
      void registerKbPackSkills(skillsCtx, getKbContext(), {
        enabled,
        providerLabel: 'netxops-kb-pack-host',
        signal: packAbort.signal,
      }).then((dispose) => {
        if (gen !== packGeneration) {
          dispose()
          return
        }
        unregisterKbPack = dispose
      }).catch((error) => {
        skillsCtx.logger.warn('netxops: host kb pack skill register failed: %s', error)
      })
    }
    const stopWatch = watchNetxConnection(() => {
      remountHostSkills()
      remountKbSkill()
      remountKbPack()
    })
    const stopKbWatch = watchKbContext(() => {
      remountKbSkill()
      remountKbPack()
    })
    remountHostSkills()
    remountKbSkill()
    remountKbPack()
    skillsCtx.effect(() => () => {
      generation += 1
      packGeneration += 1
      skillAbort.abort()
      packAbort.abort()
      stopWatch()
      stopKbWatch()
      unregisterSkills?.()
      unregisterKbSkill?.()
      unregisterKbPack?.()
    }, 'netxops: dispose host skills')
  })

  const handleNetxopsRpc = async (endpoint: string, payload?: unknown): Promise<unknown> => {
    if (endpoint === 'presets.catalog') {
      const registry = ctx.get('agentPresets') as {
        list?: () => Promise<Array<{ id: string; name?: string; broken?: string }>>
      } | undefined
      if (!registry?.list) return { ok: false, error: 'preset_registry_unavailable' }
      const presets = await registry.list()
      return { ok: true, value: { presets: presets.map(({ id, name, broken }) => ({ id, name, broken })) } }
    }
    if (endpoint === 'tools.status') {
      const mount = getToolMountStatus()
      const connection = getNetxConnection()
      return {
        ok: true,
        value: {
          mount: mount ?? null,
          mounts: getToolMountStatuses(),
          connection: connection
            ? {
              apiUrl: connection.apiUrl,
              toolsEnabled: connection.toolsEnabled !== false,
              tokenConfigured: connection.token.trim().length > 0,
              hostGroups: connection.toolsEnabled === false ? [] : groupsForPlane(connection.groups, 'host'),
              presetGroups: connection.toolsEnabled === false ? [] : groupsForPlane(connection.groups, 'preset'),
              publicGroups: connection.toolsEnabled === false ? [] : groupsForPlane(connection.groups, 'public'),
            }
            : null,
        },
      }
    }
    if (endpoint === 'alarm-push.status') {
      return { ok: true, value: getAlarmPushStatus() }
    }
    if (endpoint === 'kb.status') {
      return { ok: true, value: getKbContext() }
    }
    if (endpoint === 'kb.reload') {
      const current = source()
      const kb = resolveKbRoot(current.kbRoot ?? '')
      publishKbContext(kb)
      applyKbEnv(kb)
      if (kb.status === 'configured') {
        ctx.logger.info(
          'netxops: kb.reload → %s (%s / %s v%s)',
          kb.realRoot,
          kb.operatorName,
          kb.country,
          kb.version,
        )
      } else if (kb.status === 'error') {
        ctx.logger.warn('netxops: kb.reload error — %s', kb.errorMessage)
      } else {
        ctx.logger.info('netxops: kb.reload → unconfigured (kbRoot empty)')
      }
      return { ok: true, value: kb }
    }
    if (endpoint === 'kb.resolve') {
      const path = extractKbResolvePath(payload)
      return { ok: true, value: resolveKbRoot(path) }
    }
    if (endpoint === 'sessions.export.status') {
      const value = await getSessionsExportStatus(ctx)
      return { ok: true, value }
    }
    if (endpoint === 'im-delivery.catalog') {
      type DshImCatalog = { listDeliveryCatalog?: () => Promise<unknown> }
      const fromGet = typeof (ctx as { get?: (name: string) => unknown }).get === 'function'
        ? (ctx as { get: (name: string) => unknown }).get('dshIm') as DshImCatalog | undefined
        : undefined
      const im = fromGet ?? (ctx as { dshIm?: DshImCatalog }).dshIm
      if (!im || typeof im.listDeliveryCatalog !== 'function') {
        return {
          ok: true,
          value: {
            available: false,
            options: [],
            reasonCode: 'im_catalog_unavailable',
            hint: 'dsh-im-ops missing or outdated — install ≥ops.24 for delivery picker',
          },
        }
      }
      try {
        const options = await im.listDeliveryCatalog()
        return {
          ok: true,
          value: {
            available: true,
            options: Array.isArray(options) ? options : [],
          },
        }
      } catch (error) {
        return {
          ok: true,
          value: {
            available: false,
            options: [],
            hint: error instanceof Error ? error.message : String(error),
          },
        }
      }
    }
    return { ok: false, error: { code: 'bad-request', message: 'Unknown endpoint.' } }
  }

  // DSH ≥0.1.5: mount /netxops on this plugin's webServer inject (connection.rpc.handle no longer registers).
  ctx.inject(['webServer', 'connection'], (mountCtx) => {
    mountCtx.effect(() => {
      const direct = mountNetxopsWebRoute(
        mountCtx,
        NETXOPS_RPC_CHANNEL,
        (endpoint, payload) => handleNetxopsRpc(endpoint, payload),
      )
      if (direct !== null) {
        mountCtx.logger.info('netxops: /netxops rpc mounted on webServer')
        return direct
      }
      type RpcHandle = (
        channel: string,
        handler: (endpoint: string, payload?: unknown) => Promise<unknown>,
      ) => (() => void) | Promise<void>
      const rpc = (mountCtx.get('connection') as { rpc?: { handle?: RpcHandle } } | undefined)?.rpc
      if (rpc && typeof rpc.handle === 'function') {
        mountCtx.logger.info('netxops: /netxops rpc mounted via connection.rpc.handle (legacy)')
        const legacy = rpc.handle(
          NETXOPS_RPC_CHANNEL,
          (endpoint, payload) => handleNetxopsRpc(endpoint, payload),
        )
        return () => { if (typeof legacy === 'function') legacy() }
      }
      mountCtx.logger.warn('netxops: /netxops rpc unavailable — settings card status disabled')
      return () => {}
    }, 'netxops: /netxops web rpc')
  })

  // Browser card: sessions export download via shared /api Fetch route.
  ctx.inject(['connection'], (connCtx) => {
    const connection = connCtx.get('connection') as {
      rpc?: { handle?: (
        channel: string,
        handler: (endpoint: string, payload?: unknown) => Promise<unknown>,
      ) => (() => void) | Promise<void> }
      fetch?: {
        register?: (route: {
          readonly path: string
          readonly methods: readonly ('GET' | 'HEAD')[]
          readonly fetch: (request: Request) => Promise<Response>
        }) => () => Promise<void>
      }
    } | undefined
    const fetchApi = connection?.fetch
    if (!fetchApi || typeof fetchApi.register !== 'function') {
      connCtx.logger.warn('netxops: connection.fetch.register unavailable — sessions export download disabled')
    } else {
      connCtx.effect(() => {
        const dispose = fetchApi.register!({
          path: NETXOPS_SESSIONS_EXPORT_PATH,
          methods: ['GET', 'HEAD'],
          fetch: async (request) => {
            if (request.method === 'HEAD') {
              return sessionsExportHeadResponse(ctx, request)
            }
            return sessionsExportResponse(ctx, request)
          },
        })
        return () => { void dispose() }
      }, 'netxops: sessions export fetch')
    }
  })

  ctx.effect(() => () => {
    disposed = true
    generation += 1
    publishNetxConnection({ ...provisional, token: '', toolsEnabled: false })
    stopAlarmPush?.()
    stopAlarmPush = undefined
    resetAlarmSession()
    resetAlarmPushStatus()
    resetKbContext()
  }, 'netxops: dispose host bridge')
}

/** Pull `path` from either `{ path }` or `{ args: { path } }` RPC payloads. */
function extractKbResolvePath(payload: unknown): string {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return ''
  const row = payload as Record<string, unknown>
  if (typeof row.path === 'string') return row.path
  const args = row.args
  if (args !== null && typeof args === 'object' && !Array.isArray(args)) {
    const path = (args as Record<string, unknown>).path
    if (typeof path === 'string') return path
  }
  return ''
}
