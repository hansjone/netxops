/**
 * Browser half — Settings → Netx Ops section (uds-auth-style page).
 *
 * Hard-inject only services present on both DSH ≤0.1.5 and ≥0.1.7.
 * Do NOT hard-inject `settingsScope`: DSH ≥0.1.7 / 0.2.0 removed it
 * (`configForms` replaced it) and a hard wait kills web boot.
 *
 * Soft-inject `configForms` first (0.2.0 desktop), then `settingsScope`
 * (≤0.1.5). Soft-inject credentials / connection / directoryPicker when present.
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
  let mounted = false

  const mountCard = (scope: SettingsFormScope<NetxopsSettings>): void => {
    if (mounted) return
    mounted = true

    const card = new NetxopsCardController(scope, ctx)

    // Optional: newer remotes that mount credentials unlock the token field.
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

    // Soft-inject Connection so the card can poll host WSS status + KB status.
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

    // Soft-inject Host directory picker for knowledge-base browse.
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

    ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section',
      id: NETXOPS_NS,
      order: 24,
      label: () => t('title'),
      locale: LOCALE_NS,
      inject: () => card.inject(),
    }, NetxopsCard))
  }

  // DSH ≥0.1.7 / 0.2.0 — profile entry id matches cordis.patch.yml `id: netxops`.
  ctx.inject(['configForms'], (formsCtx) => {
    const forms = (formsCtx as { configForms?: { get: (id: string) => SettingsFormScope<NetxopsSettings> } })
      .configForms
    if (!forms || typeof forms.get !== 'function') {
      formsCtx.logger?.warn?.('netxops: configForms present but .get missing')
      return
    }
    formsCtx.logger?.info?.('netxops: settings card via configForms')
    mountCard(forms.get(NETXOPS_NS))
  })

  // DSH ≤0.1.5 — settingsScope binder.
  ctx.inject(['settingsScope'], (scopeCtx) => {
    const binder = (scopeCtx as {
      settingsScope?: { bind: (spec: { namespace: string }) => SettingsFormScope<NetxopsSettings> }
    }).settingsScope
    if (!binder || typeof binder.bind !== 'function') {
      scopeCtx.logger?.warn?.('netxops: settingsScope present but .bind missing')
      return
    }
    if (mounted) return
    scopeCtx.logger?.info?.('netxops: settings card via settingsScope')
    mountCard(binder.bind({ namespace: NETXOPS_NS }))
  })
}
