/**
 * Browser half — Netx Ops settings UI.
 *
 * Hard-inject only `slots` + `locale`. Never wait on `settingsScope`
 * (removed in DSH ≥0.1.7 / 0.2 — `configForms` replaced it). A pending
 * inject surfaces as `waiting for service: settingsScope`, the host never
 * publishes a connection, and Netx Ops sessions get zero `netx__*` tools.
 *
 * Desktop 0.2 boot contract (aligned with dsh-search-mcp / dsh-trilium):
 * - `dsh.client.immediately: false` — stage-one prefetch must not race Host.
 * - Never `ctx.inject(['configForms'])` during apply; poll after apply returns
 *   (sync inject / accessor wait freezes "Loading plugins…").
 * - `settings.section` id ≠ Config namespace (`dsh-netxops` vs `netxops`).
 *
 * Surfaces (dual-stack):
 * - Always register `settings.section` in `apply` (Settings sidebar).
 * - Form transport: deferred `configForms` poll (0.2); one-shot
 *   `ctx.get('settingsScope')` for ≤0.1.5 only — never inject settingsScope.
 * - Soft-attach real form scopes into a deferred memory scope so Save
 *   still writes the host entry when the transport is ready.
 * - Also register `settings.plugin.item` via `configForms.whileServed`.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type { AlarmPushRpcCall } from './alarm-push-status-view.ts'
import { NetxopsCard } from './NetxopsCard.tsx'
import { NETXOPS_NS, NETXOPS_SECTION_ID, NetxopsCardController } from './controller.ts'
import { en, zh, type NetxopsLocaleKey } from './locales.ts'
import type { SettingsFormScope } from './settings-form.ts'
import { createWaitingSettingsScope, findReadySettingsForm } from './settings-form.ts'
import type { NetxopsSettings } from './controller.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.netxops': NetxopsLocaleKey
  }
}

const LOCALE_NS = 'settings.netxops'

/**
 * Services that exist on every supported DSH client roster.
 * Settings transport (`configForms` / `settingsScope`) is soft-injected below.
 */
export const inject = [
  'slots',
  'locale',
]

/**
 * Candidate form namespaces for this host row.
 * cordis.patch.yml uses `id: netxops` / `name: dsh-netxops`; Desktop may
 * expose either the bare entry id or the package name.
 */
function namespaceCandidates(ctx: ClientContext): string[] {
  const fiber = (ctx as {
    fiber?: { entry?: { options?: { id?: string, name?: string }, id?: string } }
  }).fiber?.entry
  const raw = [
    fiber?.options?.id,
    fiber?.id,
    fiber?.options?.name,
    NETXOPS_NS,
    'dsh-netxops',
  ]
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string' || !item.trim()) continue
    const id = item.replace(/^:/, '').trim()
    if (!id || out.includes(id)) continue
    // Bare package name is not a configForms namespace; keep entry ids.
    if (id === 'dsh-netxops' && !out.includes(NETXOPS_NS)) out.push(NETXOPS_NS)
    out.push(id)
  }
  if (!out.includes(NETXOPS_NS)) out.push(NETXOPS_NS)
  return out
}

type ConfigFormsLike = {
  get?: (id: string) => SettingsFormScope<NetxopsSettings>
  whileServed?: (
    namespaces: readonly string[],
    register: (served: ReadonlySet<string>) => () => void,
  ) => () => void
}

type SettingsScopeLike = {
  bind?: (spec: { namespace: string }) => SettingsFormScope<NetxopsSettings>
}

type DeferredSettingsScope = SettingsFormScope<NetxopsSettings> & {
  attach: (real: SettingsFormScope<NetxopsSettings>) => void
}

/** Waiting form so the sidebar can mount without pretending settings were saved. */
function createMemoryScope(initial: NetxopsSettings): SettingsFormScope<NetxopsSettings> {
  return createWaitingSettingsScope({ ...initial })
}

/** Swap the live transport without recreating the card controller. */
function createDeferredScope(
  fallback: SettingsFormScope<NetxopsSettings>,
): DeferredSettingsScope {
  let inner = fallback
  const outerListeners = new Set<() => void>()
  let innerOff: (() => void) | undefined
  const relay = (): void => {
    for (const listener of outerListeners) listener()
  }
  const bindInner = (): void => {
    innerOff?.()
    innerOff = inner.subscribe(relay)
  }
  bindInner()
  return {
    getSnapshot: () => inner.getSnapshot(),
    subscribe: (listener) => {
      outerListeners.add(listener)
      return () => {
        outerListeners.delete(listener)
      }
    },
    set: (field, next) => inner.set(field, next),
    unset: (field) => inner.unset(field),
    attach: (real) => {
      if (inner === real) return
      inner = real
      bindInner()
      relay()
    },
  }
}

const MEMORY_DEFAULTS: NetxopsSettings = {
  toolsEnabled: true,
  groupOpsPresets: '',
  groupTopologyPresets: '',
  groupBizMonitorPresets: '',
  groupKbPresets: '',
  apiUrl: 'http://127.0.0.1:8890',
  lang: 'zh',
  thinkingLanguage: 'auto',
  replyLanguage: 'follow-user',
  nmsProvider: 'zte-ume',
  tokenCredentialRef: 'NETX_API_TOKEN',
  alarmPushEnabled: false,
  alarmDeliverDsh: true,
  alarmDeliverIm: false,
  imBotId: '',
  imTargetId: '',
  imTargets: '',
  groupOpsInPreset: true,
  groupOpsPublic: false,
  groupTopologyInPreset: false,
  groupTopologyPublic: false,
  groupBizMonitorInPreset: true,
  groupBizMonitorPublic: false,
  kbRoot: '',
  groupKbInPreset: true,
  groupKbPublic: false,
  disabledTools: '[]',
  readOnlyOnly: false,
}

export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    try {
      return ctx.locale.register(LOCALE_NS, { zh, en })
    } catch {
      const offZh = ctx.locale.register(LOCALE_NS, 'zh', zh)
      const offEn = ctx.locale.register(LOCALE_NS, 'en', en)
      return () => {
        offZh?.()
        offEn?.()
      }
    }
  }, 'netxops: locales')

  const t = ctx.locale.bind(LOCALE_NS) as (key: NetxopsLocaleKey) => string
  const deferred = createDeferredScope(createMemoryScope(MEMORY_DEFAULTS))
  const card = new NetxopsCardController(deferred, ctx)
  let pluginsItemId: string | undefined
  let wiredExtras = false

  const ensureExtras = (): void => {
    if (wiredExtras) return
    wiredExtras = true
    // Soft-inject optional remotes only after the section is up. Unknown
    // inject keys on some Desktop builds must not take down web boot.
    try {
      wireOptionalServices(ctx, card)
    } catch (error) {
      ctx.logger?.warn?.('netxops: optional remotes skipped: %s', error)
    }
  }

  /** Settings sidebar — id must not equal Config ns `netxops`. */
  try {
    ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section',
      id: NETXOPS_SECTION_ID,
      order: 24,
      label: () => t('title'),
      locale: LOCALE_NS,
      inject: () => {
        ensureExtras()
        return card.inject()
      },
    }, NetxopsCard))
  } catch (error) {
    ctx.logger?.warn?.('netxops: settings.section unavailable: %s', error)
  }

  /** Plugins-page companion card (DSH ≥0.1.7 / 0.2.0). */
  const registerPluginsItem = (id: string): (() => void) => {
    if (pluginsItemId === id) return () => {}
    try {
      const off = ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
        name: 'settings.plugin.item',
        key: id,
        locale: LOCALE_NS,
        inject: () => {
          ensureExtras()
          return card.inject()
        },
      }, NetxopsCard))
      pluginsItemId = id
      return () => {
        if (pluginsItemId === id) pluginsItemId = undefined
        off()
      }
    } catch (error) {
      ctx.logger?.warn?.('netxops: plugins.item unavailable: %s', error)
      return () => {}
    }
  }

  const tryGetForm = (
    forms: ConfigFormsLike,
    candidates: readonly string[],
  ): { ns: string, scope: SettingsFormScope<NetxopsSettings> } | undefined => {
    return findReadySettingsForm(forms, candidates)
  }

  const attachForm = (
    hit: { ns: string, scope: SettingsFormScope<NetxopsSettings> },
    source: string,
  ): (() => void) => {
    ctx.logger?.info?.('netxops: attach form via %s (%s)', source, hit.ns)
    deferred.attach(hit.scope)
    ensureExtras()
    return registerPluginsItem(hit.ns)
  }

  // DSH ≥0.1.7 / 0.2.0 — attach configForms by deferred poll.
  // Never ctx.inject(['configForms']) or read ctx.configForms during apply:
  // on Desktop 0.2 that waits and freezes "Loading plugins…".
  let formsAttached = false
  const tryAttachForms = (): boolean => {
    if (formsAttached) return true
    try {
      // Direct ctx.configForms requires an inject edge even after apply. get()
      // is Cordis' non-blocking lookup for an optional, currently active service.
      const forms = ctx.get('configForms') as ConfigFormsLike | undefined
      if (!forms || typeof forms.get !== 'function') return false
      const candidates = namespaceCandidates(ctx)
      const hit = tryGetForm(forms, candidates)
      if (!hit) return false
      ctx.logger?.info?.('netxops: configForms candidates=%s', candidates.join(','))
      ctx.effect(
        () => attachForm(hit, 'poll'),
        'netxops: configForms poll attach',
      )
      if (typeof forms.whileServed === 'function') {
        ctx.effect(() => forms.whileServed!(candidates, (served) => {
          const ns = candidates.find((id) => served.has(id))
          if (!ns) {
            ctx.logger?.warn?.(
              'netxops: whileServed fired but none of %s are served (have=%s)',
              candidates.join(','),
              [...served].join(',') || '(empty)',
            )
            return () => {}
          }
          const next = tryGetForm(forms, [ns, ...candidates])
          if (!next) {
            ctx.logger?.warn?.('netxops: served %s but configForms.get failed', ns)
            return () => {}
          }
          return attachForm(next, 'whileServed')
        }), 'netxops: configForms whileServed')
      }
      formsAttached = true
      return true
    } catch {
      return false
    }
  }
  /** DSH ≤0.1.5 only — one-shot bind when configForms never appears. */
  const tryLegacySettingsScope = (): boolean => {
    if (formsAttached) return true
    try {
      const getter = (ctx as { get?: (name: string) => unknown }).get
      if (typeof getter !== 'function') return false
      const binder = getter.call(ctx, 'settingsScope') as SettingsScopeLike | undefined
      if (!binder || typeof binder.bind !== 'function') return false
      ctx.logger?.info?.('netxops: attach form via settingsScope (legacy one-shot)')
      deferred.attach(binder.bind({ namespace: NETXOPS_NS }))
      ensureExtras()
      formsAttached = true
      return true
    } catch (error) {
      ctx.logger?.warn?.('netxops: legacy settingsScope probe failed: %s', error)
      return false
    }
  }

  // Defer all form-transport probes until after apply returns.
  const startFormsPoll = (): void => {
    if (tryAttachForms() || tryLegacySettingsScope()) return
    let ticks = 0
    const timer = setInterval(() => {
      ticks += 1
      if (tryAttachForms() || (ticks >= 3 && tryLegacySettingsScope())) {
        clearInterval(timer)
      }
    }, 1_000)
    try {
      ctx.effect(() => () => clearInterval(timer), 'netxops: configForms poll')
    } catch {
      clearInterval(timer)
    }
  }
  setTimeout(startFormsPoll, 0)
}

/** Soft-wire credentials / connection / directoryPicker when present. */
function wireOptionalServices(ctx: ClientContext, card: NetxopsCardController): void {
  const soft = (deps: string[], run: (c: ClientContext) => void, label: string): void => {
    try {
      ctx.inject(deps, (inner) => {
        try {
          run(inner)
        } catch (error) {
          inner.logger?.warn?.('netxops: %s handler failed: %s', label, error)
        }
      })
    } catch (error) {
      ctx.logger?.warn?.('netxops: soft-inject %s skipped: %s', label, error)
    }
  }

  soft(['remote.credentials'], (credCtx) => {
    card.setCredentialsAvailable(true)
    credCtx.effect(() => {
      const off = credCtx.remote.$on('credentials/reference-updated', (ref) => {
        card.refreshCredential(String(ref))
      })
      return () => {
        off()
        card.setCredentialsAvailable(false)
      }
    }, 'netxops: credential invalidations')
  }, 'remote.credentials')

  soft(['connection'], (connCtx) => {
    const connection = connCtx.get('connection') as { rpc?: { call?: AlarmPushRpcCall } } | undefined
    const call = connection?.rpc?.call?.bind(connection.rpc)
    if (typeof call !== 'function') {
      connCtx.logger?.warn?.('netxops: connection.rpc.call unavailable — alarm status UI disabled')
      return
    }
    card.setAlarmPushRpc(call)
    connCtx.effect(() => () => {
      card.setAlarmPushRpc(undefined)
    }, 'netxops: clear alarm-push rpc')
  }, 'connection')

  const bindDirectoryPicker = (picker: { pick?: (signal?: AbortSignal) => Promise<unknown> } | undefined): void => {
    if (!picker || typeof picker.pick !== 'function') return
    card.setDirectoryPicker({ pick: picker.pick.bind(picker) })
  }
  bindDirectoryPicker(ctx.get('remote.directoryPicker') as
    { pick?: (signal?: AbortSignal) => Promise<unknown> } | undefined)
  soft(['remote.directoryPicker'], (dpCtx) => {
    const viaGet = typeof (dpCtx as { get?: (name: string) => unknown }).get === 'function'
      ? (dpCtx as { get: (name: string) => unknown }).get('remote.directoryPicker') as
        | { pick?: (signal?: AbortSignal) => Promise<unknown> }
        | undefined
      : undefined
    const viaNested = (dpCtx as { remote?: { directoryPicker?: { pick?: (signal?: AbortSignal) => Promise<unknown> } } })
      .remote?.directoryPicker
    bindDirectoryPicker(viaGet ?? viaNested)
    dpCtx.effect(() => () => {
      card.setDirectoryPicker(undefined)
    }, 'netxops: clear directory picker')
  }, 'remote.directoryPicker')
}
