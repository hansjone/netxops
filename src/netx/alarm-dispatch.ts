/**
 * Fan-out one key-alarm to optional DSH session + IM sinks.
 * Sinks run in parallel so a failing/slow session path cannot block WhatsApp/IM.
 */

import type { Context } from '@deepseek-ai/cordis'
import { deliverAlarmToIm, type AlarmImDeliveryOptions } from './alarm-im.ts'
import { deliverAlarmToSession } from './alarm-session.ts'
import type { KeyAlarmPayload } from './alarm-push.ts'
import type { ImDeliveryTarget } from './im-targets.ts'

export interface AlarmSinkDispatchOptions {
  deliverDsh: boolean
  deliverIm: boolean
  imTargets: readonly ImDeliveryTarget[]
  lang: string
}

export interface AlarmSinkFns {
  toSession?: typeof deliverAlarmToSession
  toIm?: typeof deliverAlarmToIm
}

/**
 * Deliver to every enabled sink; never let one sink's rejection cancel the others.
 * @returns settled results in order: [session?, im] (session omitted when deliverDsh is false).
 */
export async function dispatchAlarmToSinks(
  ctx: Context,
  payload: KeyAlarmPayload,
  options: AlarmSinkDispatchOptions,
  sinks: AlarmSinkFns = {},
): Promise<PromiseSettledResult<void>[]> {
  const toSession = sinks.toSession ?? deliverAlarmToSession
  const toIm = sinks.toIm ?? deliverAlarmToIm
  const jobs: Array<Promise<void>> = []
  if (options.deliverDsh) {
    jobs.push(toSession(ctx, payload, options.lang))
  }
  const imOptions: AlarmImDeliveryOptions = {
    enabled: options.deliverIm,
    targets: options.imTargets,
    lang: options.lang,
  }
  jobs.push(toIm(ctx, payload, imOptions))

  const results = await Promise.allSettled(jobs)
  for (const result of results) {
    if (result.status === 'rejected') {
      ctx.logger.warn('netxops alarm-push: sink failed: %s', result.reason)
    }
  }
  return results
}
