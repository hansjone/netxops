/**
 * Browser half — Netx Ops settings UI.
 *
 * Hard-inject only services present on both DSH ≤0.1.5 and ≥0.1.7.
 * Do NOT hard-inject `settingsScope`: DSH ≥0.1.7 / 0.2.0 removed it
 * (`configForms` replaced it) and a hard wait kills web boot.
 *
 * Surfaces (dual-stack), matching working plugins like dsh-im-ops:
 * - Always register `settings.section` once a form scope is available
 *   (Settings sidebar — what operators look for).
 * - On ≥0.1.7 also register `plugins.item` via `configForms.whileServed`
 *   (Plugins page companion card).
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { NetxopsCard } from './NetxopsCard.tsx'
import { NETXOPS_NS, NetxopsCardController } from './controller.ts'
import { en, zh, type NetxopsLocaleKey } from './locales.ts'
import type { SettingsFormScope } from './settings-form.ts'
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
    (ctx as { name?: string }).name,
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
  let card: NetxopsCardController | undefined
  let wiredExtras = false
  let sectionRegistered = false
  let pluginsItemId: string | undefined

  const ensureCard = (scope: SettingsFormScope<NetxopsSettings>): NetxopsCardController => {
    if (card) return card
    card = new NetxopsCardController(scope, ctx)
    if (!wiredExtras) {
      wiredExtras = true
      wireOptionalServices(ctx, card)
    }
    return card
  }

  /** Settings sidebar page — same surface im-ops uses (must not wait on whileServed alone). */
  const registerSection = (owner: NetxopsCardController): (() => void) => {
    if (sectionRegistered) return () => {}
    try {
      const off = ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: NETXOPS_NS,
        order: 24,
        label: () => t('title'),
        locale: LOCALE_NS,
        inject: () => owner.inject(),
      }, NetxopsCard))
      sectionRegistered = true
      return () => {
        sectionRegistered = false
        off()
      }
    } catch (error) {
      ctx.logger?.warn?.('netxops: settings.section unavailable: %s', error)
      return () => {}
    }
  }

  /** Plugins-page companion card (DSH ≥0.1.7 / 0.2.0). */
  const registerPluginsItem = (owner: NetxopsCardController, id: string): (() => void) => {
    if (pluginsItemId === id) return () => {}
    try {
      const off = ctx.slots.inject('plugins.item', () => ctx.slots.register({
        name: 'plugins.item',
        id,
        order: 24,
        label: () => t('title'),
        locale: LOCALE_NS,
        inject: () => owner.inject(),
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

  const mountUi = (
    owner: NetxopsCardController,
    ns: string,
    opts: { section: boolean, pluginsItem: boolean },
  ): (() => void) => {
    const offs: Array<() => void> = []
    if (opts.section) offs.push(registerSection(owner))
    if (opts.pluginsItem) offs.push(registerPluginsItem(owner, ns))
    return () => {
      for (const off of offs) off()
    }
  }

  const tryGetForm = (
    forms: ConfigFormsLike,
    candidates: readonly string[],
  ): { ns: string, scope: SettingsFormScope<NetxopsSettings> } | undefined => {
    if (typeof forms.get !== 'function') return undefined
    for (const ns of candidates) {
      try {
        const scope = forms.get(ns)
        if (scope && typeof scope.getSnapshot === 'function') return { ns, scope }
      } catch {
        // wrong ns — try next
      }
    }
    return undefined
  }

  // DSH ≥0.1.7 / 0.2.0 — configForms.
  ctx.inject(['configForms'], (formsCtx) => {
    const forms = (formsCtx as { configForms?: ConfigFormsLike }).configForms
    if (!forms) {
      formsCtx.logger?.warn?.('netxops: configForms inject fired but service missing')
      return
    }
    const candidates = namespaceCandidates(formsCtx)
    formsCtx.logger?.info?.('netxops: configForms candidates=%s', candidates.join(','))

    if (typeof forms.whileServed === 'function') {
      formsCtx.effect(() => forms.whileServed!(candidates, (served) => {
        const ns = candidates.find((id) => served.has(id))
        if (!ns) {
          formsCtx.logger?.warn?.(
            'netxops: whileServed fired but none of %s are served (have=%s)',
            candidates.join(','),
            [...served].join(',') || '(empty)',
          )
          return () => {}
        }
        const hit = tryGetForm(forms, [ns, ...candidates])
        if (!hit) {
          formsCtx.logger?.warn?.('netxops: served %s but configForms.get failed', ns)
          return () => {}
        }
        formsCtx.logger?.info?.('netxops: settings via whileServed (%s)', hit.ns)
        const owner = ensureCard(hit.scope)
        return mountUi(owner, hit.ns, { section: true, pluginsItem: true })
      }), 'netxops: configForms whileServed')
    }

    // Eager fallback: do not leave Settings blank if whileServed is late/empty.
    const immediate = tryGetForm(forms, candidates)
    if (immediate) {
      formsCtx.logger?.info?.('netxops: settings eager mount (%s)', immediate.ns)
      const owner = ensureCard(immediate.scope)
      formsCtx.effect(
        () => mountUi(owner, immediate.ns, { section: true, pluginsItem: true }),
        'netxops: configForms eager slots',
      )
    } else if (typeof forms.whileServed !== 'function') {
      formsCtx.logger?.warn?.('netxops: configForms present but no get/whileServed match for %s', candidates.join(','))
    }
  })

  // DSH ≤0.1.5 — settingsScope binder + settings.section only.
  ctx.inject(['settingsScope'], (scopeCtx) => {
    if (card) return
    const binder = (scopeCtx as { settingsScope?: SettingsScopeLike }).settingsScope
    if (!binder || typeof binder.bind !== 'function') {
      scopeCtx.logger?.warn?.('netxops: settingsScope present but .bind missing')
      return
    }
    scopeCtx.logger?.info?.('netxops: settings card via settingsScope')
    const owner = ensureCard(binder.bind({ namespace: NETXOPS_NS }))
    scopeCtx.effect(() => registerSection(owner), 'netxops: settings.section')
  })
}

/** Soft-wire credentials / connection / directoryPicker when present. */
function wireOptionalServices(ctx: ClientContext, card: NetxopsCardController): void {
  ctx.inject(['remote.credentials'], (credCtx) => {
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
  })

  ctx.inject(['connection'], (connCtx) => {
    const call = connCtx.connection?.rpc?.call?.bind(connCtx.connection.rpc)
    if (typeof call !== 'function') {
      connCtx.logger.warn('netxops: connection.rpc.call unavailable — alarm status UI disabled')
      return
    }
    card.setAlarmPushRpc(call)
    connCtx.effect(() => () => {
      card.setAlarmPushRpc(undefined)
    }, 'netxops: clear alarm-push rpc')
  })

  const bindDirectoryPicker = (picker: { pick?: (signal?: AbortSignal) => Promise<string | null> } | undefined): void => {
    if (!picker || typeof picker.pick !== 'function') return
    card.setDirectoryPicker(picker as { pick: (signal?: AbortSignal) => Promise<string | null> })
  }
  bindDirectoryPicker(
    (ctx as { remote?: { directoryPicker?: { pick?: (signal?: AbortSignal) => Promise<string | null> } } })
      .remote?.directoryPicker,
  )
  ctx.inject(['remote.directoryPicker'], (dpCtx) => {
    const viaGet = typeof (dpCtx as { get?: (name: string) => unknown }).get === 'function'
      ? (dpCtx as { get: (name: string) => unknown }).get('remote.directoryPicker') as
        | { pick?: (signal?: AbortSignal) => Promise<string | null> }
        | undefined
      : undefined
    const viaNested = (dpCtx as { remote?: { directoryPicker?: { pick?: (signal?: AbortSignal) => Promise<string | null> } } })
      .remote?.directoryPicker
    bindDirectoryPicker(viaGet ?? viaNested)
    dpCtx.effect(() => () => {
      card.setDirectoryPicker(undefined)
    }, 'netxops: clear directory picker')
  })
}
