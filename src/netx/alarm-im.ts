/**
 * Optional IM sink for key alarms (soft-depends on dsh-im `ctx.dshIm`).
 * Fan-out: one alarm can be delivered to every configured WhatsApp / IM target.
 */

import type { Context } from '@deepseek-ai/cordis'
import { formatAlarmPrompt, type KeyAlarmPayload } from './alarm-push.ts'
import {
  normalizeImTarget,
  resolveImTargets,
  type ImDeliveryTarget,
} from './im-targets.ts'

export interface AlarmImDeliveryOptions {
  enabled: boolean
  /** Preferred multi-target list (JSON settings or already parsed). */
  targets?: readonly ImDeliveryTarget[]
  /** Legacy single-target fields (used when `targets` is empty). */
  botId?: string
  targetId?: string
  /** Raw `imTargets` settings string (optional; used with legacy fields). */
  imTargets?: string
  lang: string
}

type DshIm = {
  send: (botId: string, targetId: string, text: string, opts?: { signal?: AbortSignal }) => Promise<unknown>
}

function resolveTargets(options: AlarmImDeliveryOptions): ImDeliveryTarget[] {
  if (options.targets && options.targets.length > 0) {
    const out: ImDeliveryTarget[] = []
    const seen = new Set<string>()
    for (const entry of options.targets) {
      const target = normalizeImTarget(entry)
      if (!target) continue
      const key = `${target.botId}::${target.targetId}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(target)
    }
    return out
  }
  return resolveImTargets({
    imTargets: options.imTargets,
    imBotId: options.botId,
    imTargetId: options.targetId,
  })
}

/**
 * Send a formatted key-alarm text through proactive IM delivery when configured.
 * @param ctx - host cordis context (may lack `dshIm`).
 * @param payload - matched alarm.
 * @param options - settings snapshot for IM sink(s).
 */
export async function deliverAlarmToIm(
  ctx: Context,
  payload: KeyAlarmPayload,
  options: AlarmImDeliveryOptions,
): Promise<void> {
  if (!options.enabled) return
  const targets = resolveTargets(options)
  if (targets.length === 0) {
    ctx.logger.warn(
      'netxops alarm-im: enabled but no delivery targets — skip IM delivery (pick one or more targets under Netx Ops → IM)',
    )
    return
  }

  // Soft inject: im plugin may be absent on this profile.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const im = (typeof (ctx as any).get === 'function' ? (ctx as any).get('dshIm') : undefined) as DshIm | undefined
    ?? ((ctx as { dshIm?: DshIm }).dshIm)
  if (!im || typeof im.send !== 'function') {
    ctx.logger.warn(
      'netxops alarm-im: ctx.dshIm unavailable — install/enable dsh-im-ops to deliver alarms to WhatsApp/IM',
    )
    return
  }

  const text = formatAlarmPrompt(payload, options.lang)
  const results = await Promise.allSettled(
    targets.map((target) => im.send(target.botId, target.targetId, text)),
  )
  results.forEach((result, index) => {
    const target = targets[index]!
    if (result.status === 'fulfilled') {
      ctx.logger.info(
        'netxops alarm-im: sent to botId=%s targetId=%s',
        target.botId,
        target.targetId,
      )
      return
    }
    ctx.logger.warn(
      'netxops alarm-im: send failed botId=%s targetId=%s: %s',
      target.botId,
      target.targetId,
      result.reason,
    )
  })
}
