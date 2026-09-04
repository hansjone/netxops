/**
 * Browser half — Settings → Plugins → Netx Ops card.
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
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import { NetxopsCard } from './NetxopsCard.tsx'
import { NETXOPS_NS, NetxopsCardController } from './controller.ts'
import { en, zh, type NetxopsLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.netxops': NetxopsLocaleKey
  }
}

const LOCALE_NS = 'settings.netxops'

/** Match shipped ui-settings-plugins inject (no remote.credentials). */
export const inject = [
  'slots',
  'locale',
  'remote',
  'settingsScope',
]

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), 'netxops: locales')

  const card = new NetxopsCardController(
    ctx.settingsScope.bind({ namespace: NETXOPS_NS }),
    ctx,
  )

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

  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: NETXOPS_NS,
    locale: LOCALE_NS,
    inject: () => card.inject(),
  }, NetxopsCard))
}
