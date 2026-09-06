import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  formatImTargetsJson,
  parseImTargetsJson,
  resolveImTargets,
  setImTargetSelected,
} from '../src/netx/im-targets.ts'
import { deliverAlarmToIm } from '../src/netx/alarm-im.ts'

test('parseImTargetsJson dedupes and drops incomplete rows', () => {
  const rows = parseImTargetsJson(JSON.stringify([
    { botId: 'b1', targetId: 't1' },
    { botId: 'b1', targetId: 't1' },
    { botId: 'b2', targetId: '' },
    { botId: 'b2', targetId: 't2' },
  ]))
  assert.deepEqual(rows, [
    { botId: 'b1', targetId: 't1' },
    { botId: 'b2', targetId: 't2' },
  ])
})

test('resolveImTargets prefers imTargets JSON over legacy pair', () => {
  assert.deepEqual(resolveImTargets({
    imTargets: formatImTargetsJson([
      { botId: 'b1', targetId: 'g1' },
      { botId: 'b1', targetId: 'g2' },
    ]),
    imBotId: 'legacy',
    imTargetId: 'old',
  }), [
    { botId: 'b1', targetId: 'g1' },
    { botId: 'b1', targetId: 'g2' },
  ])
  assert.deepEqual(resolveImTargets({
    imTargets: '',
    imBotId: 'legacy',
    imTargetId: 'old',
  }), [{ botId: 'legacy', targetId: 'old' }])
})

test('setImTargetSelected toggles membership', () => {
  const one = setImTargetSelected([], { botId: 'b', targetId: 't' }, true)
  assert.deepEqual(one, [{ botId: 'b', targetId: 't' }])
  assert.deepEqual(setImTargetSelected(one, { botId: 'b', targetId: 't' }, false), [])
})

test('deliverAlarmToIm fans out to every target', async () => {
  const sent = []
  const ctx = {
    logger: { warn() {}, info() {} },
    get: () => ({
      send: async (botId, targetId, text) => {
        sent.push({ botId, targetId, text })
      },
    }),
  }
  await deliverAlarmToIm(ctx, {
    action: 'inserted',
    rule_label: 'Power Down',
    object_name: 'PORT-1',
    perceived_severity: 'critical',
    native_probable_cause: 'LOS',
    time_created: '2026-01-01T00:00:00Z',
    notification_id: 'n1',
    alarm_key: 'k1',
    ne: { host_name: 'PE1', ip_address: '10.0.0.1' },
  }, {
    enabled: true,
    lang: 'zh',
    targets: [
      { botId: 'bot', targetId: 'g1' },
      { botId: 'bot', targetId: 'g2' },
    ],
  })
  assert.equal(sent.length, 2)
  assert.equal(sent[0].targetId, 'g1')
  assert.equal(sent[1].targetId, 'g2')
  assert.match(sent[0].text, /告警产生/)
})
