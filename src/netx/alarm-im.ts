/**
 * Optional IM sink for key alarms (soft-depends on dsh-im `ctx.dshIm`).
 */

import type { Context } from '@deepseek-ai/cordis'
import { formatAlarmPrompt, type KeyAlarmPayload } from './alarm-push.ts'

export interface AlarmImDeliveryOptions {
  enabled: boolean
  botId: string
  targetId: string
  lang: string
}

type DshIm = {
  send: (botId: string, targetId: string, text: string, opts?: { signal?: AbortSignal }) => Promise<unknown>
}

/**
 * Send a formatted key-alarm text through proactive IM delivery when configured.
 * @param ctx - host cordis context (may lack `dshIm`).
 * @param payload - matched alarm.
 * @param options - settings snapshot for IM sink.
 */
export async function deliverAlarmToIm(
  ctx: Context,
  payload: KeyAlarmPayload,
  options: AlarmImDeliveryOptions,
): Promise<void> {
  if (!options.enabled) return
  const botId = options.botId.trim()
  const targetId = options.targetId.trim()
  if (!botId || !targetId) {
    ctx.logger.warn(
      'netxops alarm-im: enabled but imBotId/imTargetId empty — skip IM delivery (create a target in IM 投递设置 and paste botId+targetId)',
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
  try {
    await im.send(botId, targetId, text)
    ctx.logger.info('netxops alarm-im: sent to botId=%s targetId=%s', botId, targetId)
  } catch (error) {
    ctx.logger.warn('netxops alarm-im: send failed: %s', error)
  }
}
