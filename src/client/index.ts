/**
 * Browser half — Netx Ops settings UI.
 *
 * Hard-inject only services present on both DSH ≤0.1.5 and ≥0.1.7.
 * Do NOT hard-inject `settingsScope`: DSH ≥0.1.7 / 0.2.0 removed it
 * (`configForms` replaced it) and a hard wait kills web boot.
 *
 * Surfaces (dual-stack):
 * - DSH ≤0.1.5: `settings.section` + `settingsScope.bind({ namespace })`
 * - DSH ≥0.1.7 / 0.2.0: `plugins.item` via `configForms.whileServed` +
 *   `configForms.get(entryId)` (Plugins page). Also keep `settings.section`
 *   when that slot still exists so older shells keep a top-level nav entry.
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
 * Bare Loader entry id for this client half.
 * DSH 0.2.0 configForms namespaces are entry ids (not package names);
 * fiber scope keys may be prefixed with `:`.
 */
function entryIdOf(ctx: ClientContext): string {
  const fiber = (ctx as {
    fiber?: { entry?: { options?: { id?: string }, id?: string } }
  }).fiber?.entry
  const raw = fiber?.options?.id
    ?? fiber?.id
    ?? (ctx as { name?: string }).name
    ?? NETXOPS_NS
  const id = String(raw).replace(/^:/, '').trim()
  return id.length > 0 ? id : NETXOPS_NS
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

  const ensureCard = (scope: SettingsFormScope<NetxopsSettings>): NetxopsCardController => {
    if (card) return card
    card = new NetxopsCardController(scope, ctx)
    if (!wiredExtras) {
      wiredExtras = true
      wireOptionalServices(ctx, card)
    }
    return card
  }

  const registerSection = (owner: NetxopsCardController): (() => void) => {
    try {
      return ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: NETXOPS_NS,
        order: 24,
        label: () => t('title'),
        locale: LOCALE_NS,
        inject: () => owner.inject(),
      }, NetxopsCard))
    } catch (error) {
      ctx.logger?.warn?.('netxops: settings.section unavailable: %s', error)
      return () => {}
    }
  }

  const registerPluginsItem = (owner: NetxopsCardController, id: string): (() => void) => {
    try {
      return ctx.slots.inject('plugins.item', () => ctx.slots.register({
        name: 'plugins.item',
        id,
        order: 24,
        label: () => t('title'),
        locale: LOCALE_NS,
        inject: () => owner.inject(),
      }, NetxopsCard))
    } catch (error) {
      ctx.logger?.warn?.('netxops: plugins.item unavailable: %s', error)
      return () => {}
    }
  }

  // DSH ≥0.1.7 / 0.2.0 — Plugins page via configForms.whileServed + get(entryId).
  ctx.inject(['configForms'], (formsCtx) => {
    const forms = (formsCtx as { configForms?: ConfigFormsLike }).configForms
    if (!forms) {
      formsCtx.logger?.warn?.('netxops: configForms inject fired but service missing')
      return
    }
    const entryId = entryIdOf(formsCtx)
    const ns = entryId || NETXOPS_NS

    if (typeof forms.whileServed === 'function' && typeof forms.get === 'function') {
      formsCtx.logger?.info?.('netxops: settings card via configForms.whileServed (%s)', ns)
      formsCtx.effect(() => forms.whileServed!([ns], (served) => {
        if (!served.has(ns)) return () => {}
        const owner = ensureCard(forms.get!(ns))
        const offItem = registerPluginsItem(owner, ns)
        // Keep top-level section when the shell still projects it.
        const offSection = registerSection(owner)
        return () => {
          offItem()
          offSection()
        }
      }), 'netxops: plugins.item whileServed')
      return
    }

    if (typeof forms.get === 'function') {
      formsCtx.logger?.info?.('netxops: settings card via configForms.get (%s)', ns)
      const owner = ensureCard(forms.get(ns))
      formsCtx.effect(() => {
        const offItem = registerPluginsItem(owner, ns)
        const offSection = registerSection(owner)
        return () => {
          offItem()
          offSection()
        }
      }, 'netxops: configForms slots')
    } else {
      formsCtx.logger?.warn?.('netxops: configForms present but .get missing')
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
