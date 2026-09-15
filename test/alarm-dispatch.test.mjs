import assert from 'node:assert/strict'
import { test } from 'node:test'

import { dispatchAlarmToSinks } from '../src/netx/alarm-dispatch.ts'

test('dispatchAlarmToSinks still delivers IM when DSH session rejects', async () => {
  let imCalls = 0
  const warnings = []
  const ctx = {
    logger: {
      warn: (...args) => { warnings.push(args.map(String).join(' ')) },
      info() {},
    },
  }
  const results = await dispatchAlarmToSinks(
    ctx,
    {
      action: 'inserted',
      rule_label: 'Power Down',
      alarm_key: 'k1',
      ne: { host_name: 'PE1' },
    },
    {
      deliverDsh: true,
      deliverIm: true,
      imTargets: [{ botId: 'bot', targetId: 'tgt' }],
      lang: 'zh',
    },
    {
      toSession: async () => {
        throw new Error('sticky session exploded')
      },
      toIm: async () => {
        imCalls += 1
      },
    },
  )
  assert.equal(imCalls, 1)
  assert.equal(results.length, 2)
  assert.equal(results[0].status, 'rejected')
  assert.equal(results[1].status, 'fulfilled')
  assert.ok(warnings.some((line) => line.includes('sink failed')))
})

test('dispatchAlarmToSinks skips session job when deliverDsh is false', async () => {
  let sessionCalls = 0
  let imCalls = 0
  const ctx = { logger: { warn() {}, info() {} } }
  const results = await dispatchAlarmToSinks(
    ctx,
    { action: 'inserted', alarm_key: 'k1' },
    {
      deliverDsh: false,
      deliverIm: true,
      imTargets: [{ botId: 'bot', targetId: 'tgt' }],
      lang: 'zh',
    },
    {
      toSession: async () => { sessionCalls += 1 },
      toIm: async () => { imCalls += 1 },
    },
  )
  assert.equal(sessionCalls, 0)
  assert.equal(imCalls, 1)
  assert.equal(results.length, 1)
  assert.equal(results[0].status, 'fulfilled')
})
