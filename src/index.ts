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
import { deliverAlarmToIm } from './netx/alarm-im.ts'
import { deliverAlarmToSession, resetAlarmSession } from './netx/alarm-session.ts'
import {
  capabilityGroupsFromSettings,
  groupsForPlane,
  type NetxCapabilityGroupSettingsFields,
} from './netx/capability-groups.ts'
import { registerGroupSkills } from './netx/group-skills.ts'
import { resolveImTargets } from './netx/im-targets.ts'
import { registerKbContextSkill } from './netx/kb-context-skill.ts'
import { resolveKbRoot } from './netx/kb-manifest.ts'
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
  resolveThinkingLanguage,
  thinkingInstruction,
  thinkingReminder,
} from './netx/model-language.ts'
import { publishNetxConnection, getNetxConnection, watchNetxConnection } from './netx/runtime.ts'
import {
  getSessionsExportStatus,
  NETXOPS_SESSIONS_EXPORT_PATH,
  sessionsExportHeadResponse,
  sessionsExportResponse,
} from './netx/session-export.ts'
import { registerNetxTools } from './netx/tools.ts'

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
   * Copy bundled agent preset + skills into `$DSH_HOME/.agent-presets/netxops`
   * on every activate (required for Settings → Agent presets).
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
  /** Publish ops tools/skills to other presets (default off). */
  groupOpsPublic: boolean
  /** topology canvas / layout tools in the Netx Ops preset (default off). */
  groupTopologyInPreset: boolean
  /** Publish topology tools/skills to other presets (default off). */
  groupTopologyPublic: boolean
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

export const Config: z<Config> = z.object({
  apiUrl: z.string().default('http://127.0.0.1:8890'),
  lang: z.string().default('zh'),
  thinkingLanguage: z.string().default('auto'),
  replyLanguage: z.string().default('follow-user'),
  tokenCredentialRef: z.string().role('credential-ref').default(DEFAULT_TOKEN_REF),
  toolCallTimeoutMs: z.number().step(1).min(1000).default(120_000),
  installAgentPreset: z.boolean().default(true),
  alarmPushEnabled: z.boolean().default(false),
  alarmDeliverDsh: z.boolean().default(true),
  alarmDeliverIm: z.boolean().default(false),
  imTargets: z.string().default(''),
  imBotId: z.string().default(''),
  imTargetId: z.string().default(''),
  nmsProvider: z.string().default('zte-ume'),
  groupOpsInPreset: z.boolean().default(true),
  groupOpsPublic: z.boolean().default(false),
  groupTopologyInPreset: z.boolean().default(false),
  groupTopologyPublic: z.boolean().default(false),
  kbRoot: z.string().default(''),
  groupKbInPreset: z.boolean().default(true),
  groupKbPublic: z.boolean().default(false),
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
    const lang = current.lang
    const deliverDsh = current.alarmDeliverDsh !== false
    const imTargets = resolveImTargets({
      imTargets: current.imTargets ?? '',
      imBotId: current.imBotId ?? '',
      imTargetId: current.imTargetId ?? '',
    })
    const deliverIm = imTargets.length > 0
    stopAlarmPush = startAlarmPushClient({
      apiUrl,
      token,
      logger: ctx.logger,
      onAlarm: async (payload) => {
        if (deliverDsh) {
          await deliverAlarmToSession(ctx, payload, lang)
        }
        await deliverAlarmToIm(ctx, payload, {
          enabled: deliverIm,
          targets: imTargets,
          lang,
        })
      },
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
      const groups = capabilityGroupsFromSettings(current as NetxCapabilityGroupSettingsFields)
      if (current.nmsProvider && current.nmsProvider !== 'zte-ume') {
        ctx.logger.warn(
          'netxops: nmsProvider=%s is not implemented yet; using zte-ume REST adapter',
          current.nmsProvider,
        )
      }
      publishNetxConnection({
        apiUrl,
        token,
        lang: current.lang,
        toolCallTimeoutMs: current.toolCallTimeoutMs,
        groups,
        groupKbInPreset: current.groupKbInPreset !== false,
        groupKbPublic: current.groupKbPublic === true,
      })
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
      restartAlarmPush(current, apiUrl, token)
      if (!tokenConfigured) {
        ctx.logger.warn(
          'netxops: published connection → %s tokenConfigured=false (set credential %s)',
          apiUrl,
          current.tokenCredentialRef,
        )
      } else {
        const imSinkCount = resolveImTargets({
          imTargets: current.imTargets ?? '',
          imBotId: current.imBotId ?? '',
          imTargetId: current.imTargetId ?? '',
        }).length
        ctx.logger.info(
          'netxops: published connection → %s tokenConfigured=true alarmPush=%s dsh=%s im=%s public=[%s]',
          apiUrl,
          current.alarmPushEnabled === true,
          current.alarmDeliverDsh !== false,
          imSinkCount,
          groupsForPlane(groups, 'public').join(',') || '(none)',
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

  // Host-global model language: every preset on this Host inherits these
  // systemPrompt sections (not scoped to the Netx Ops agent preset).
  ctx.inject(['systemPrompt', 'settings'], (promptCtx) => {
    type PromptSurface = {
      section: (spec: { name: string, order: number, text: string | (() => string) }) => (() => void) | void
      context: (spec: { name: string, order: number, text: string | (() => string) }) => (() => void) | void
    }
    const systemPrompt = (promptCtx as { systemPrompt: PromptSurface }).systemPrompt
    const effectiveThinking = (): ReturnType<typeof resolveThinkingLanguage> => {
      const settings = promptCtx.get('settings') as { get?: (ns: string) => unknown } | undefined
      const current = source()
      return resolveThinkingLanguage(
        normalizeThinkingLanguage(current.thinkingLanguage),
        readSystemLocalePreference(settings),
      )
    }
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
      push(systemPrompt.section({
        name: 'netxops:reply-language',
        order: 890,
        text: () => replyInstruction(normalizeReplyLanguage(source().replyLanguage)),
      }))
      return () => {
        for (const dispose of disposers.splice(0)) dispose()
      }
    }, 'netxops: model language prompts')
  })

  // Optional host-layer publish: groups with `public=true` become visible to other presets.
  ctx.inject(['tools'], (toolsCtx) => {
    let unregisterTools: (() => void) | undefined
    const remountPublicTools = (): void => {
      unregisterTools?.()
      unregisterTools = undefined
      const connection = getNetxConnection()
      if (!connection) return
      const enabled = groupsForPlane(connection.groups, 'public')
      unregisterTools = registerNetxTools(toolsCtx, connection, { plane: 'public' })
      toolsCtx.logger.info(
        'netxops: host public tools groups=[%s]',
        enabled.join(',') || '(none)',
      )
    }
    remountPublicTools()
    const stopWatch = watchNetxConnection(() => { remountPublicTools() })
    toolsCtx.effect(() => () => {
      stopWatch()
      unregisterTools?.()
    }, 'netxops: dispose public tools')
  })

  ctx.inject(['skills'], (skillsCtx) => {
    let unregisterSkills: (() => void) | undefined
    let unregisterKbSkill: (() => void) | undefined
    let unregisterKbPack: (() => void) | undefined
    let generation = 0
    let packGeneration = 0
    const remountPublicSkills = (): void => {
      const gen = ++generation
      unregisterSkills?.()
      unregisterSkills = undefined
      const connection = getNetxConnection()
      if (!connection) return
      const enabled = groupsForPlane(connection.groups, 'public')
      void registerGroupSkills(skillsCtx, enabled, 'netxops-public').then((dispose) => {
        if (gen !== generation) {
          dispose()
          return
        }
        unregisterSkills = dispose
        skillsCtx.logger.info(
          'netxops: host public skills groups=[%s]',
          enabled.join(',') || '(none)',
        )
      }).catch((error) => {
        skillsCtx.logger.warn('netxops: public skill register failed: %s', error)
      })
    }
    const remountKbSkill = (): void => {
      unregisterKbSkill?.()
      unregisterKbSkill = undefined
      const snapshot = getKbContext()
      unregisterKbSkill = registerKbContextSkill(skillsCtx, snapshot)
      skillsCtx.logger.info(
        'netxops: kb-context skill status=%s',
        snapshot.status,
      )
    }
    const remountKbPack = (): void => {
      const gen = ++packGeneration
      unregisterKbPack?.()
      unregisterKbPack = undefined
      const connection = getNetxConnection()
      const enabled = connection?.groupKbPublic === true
      void registerKbPackSkills(skillsCtx, getKbContext(), {
        enabled,
        providerLabel: 'netxops-kb-pack-public',
      }).then((dispose) => {
        if (gen !== packGeneration) {
          dispose()
          return
        }
        unregisterKbPack = dispose
      }).catch((error) => {
        skillsCtx.logger.warn('netxops: public kb pack skill register failed: %s', error)
      })
    }
    remountPublicSkills()
    remountKbSkill()
    remountKbPack()
    const stopWatch = watchNetxConnection(() => {
      remountPublicSkills()
      remountKbPack()
    })
    const stopKbWatch = watchKbContext(() => {
      remountKbSkill()
      remountKbPack()
    })
    skillsCtx.effect(() => () => {
      generation += 1
      packGeneration += 1
      stopWatch()
      stopKbWatch()
      unregisterSkills?.()
      unregisterKbSkill?.()
      unregisterKbPack?.()
    }, 'netxops: dispose public skills')
  })

  // Browser card: alarm-push status + IM catalog (RPC) and all-sessions ZIP (Fetch).
  ctx.inject(['connection'], (connCtx) => {
    const connection = connCtx.connection as {
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
    const rpc = connection?.rpc
    if (!rpc || typeof rpc.handle !== 'function') {
      connCtx.logger.warn('netxops: connection.rpc.handle unavailable — alarm status UI disabled')
    } else {
      connCtx.effect(() => {
        const dispose = rpc.handle(
          NETXOPS_RPC_CHANNEL,
          async (endpoint: string, payload?: unknown) => {
            if (endpoint === 'alarm-push.status') {
              return { ok: true, value: getAlarmPushStatus() }
            }
            if (endpoint === 'kb.status') {
              return { ok: true, value: getKbContext() }
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
          },
        )
        return () => { void dispose() }
      }, 'netxops: alarm-push status rpc')
    }

    const fetchApi = connection?.fetch
    if (!fetchApi || typeof fetchApi.register !== 'function') {
      connCtx.logger.warn('netxops: connection.fetch.register unavailable — sessions export download disabled')
    } else {
      connCtx.effect(() => {
        const dispose = fetchApi.register({
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
    generation += 1
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
