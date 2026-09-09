/**
 * Browser half — Settings → Netx Ops section (uds-auth-style page).
 *
 * Do not hard-inject `remote.credentials`: shipped `@deepseek-ai/dsh` 0.1.1-rc.2
 * remotes assembly does not mount that namespace (Models/Plugins cards only
 * inject `remote`). Soft-inject when a newer Host provides it.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { NetxopsCard } from './NetxopsCard.tsx'
import { NETXOPS_NS, NetxopsCardController } from './controller.ts'
import { en, zh, type NetxopsLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.netxops': NetxopsLocaleKey
  }
}

const LOCALE_NS = 'settings.netxops'

/** Match shipped settings shell inject (no remote.credentials). */
export const inject = [
  'slots',
  'locale',
  'remote',
  'settingsScope',
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

  const card = new NetxopsCardController(
    ctx.settingsScope.bind({ namespace: NETXOPS_NS }),
    ctx,
  )
  const t = ctx.locale.bind(LOCALE_NS) as (key: NetxopsLocaleKey) => string

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

  // Soft-inject Connection so the card can poll host WSS status.
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

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: NETXOPS_NS,
    order: 24,
    label: () => t('title'),
    locale: LOCALE_NS,
    inject: () => card.inject(),
  }, NetxopsCard))
}
