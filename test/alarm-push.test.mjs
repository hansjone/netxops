import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  alarmSubscribeUrl,
  formatAlarmPrompt,
} from '../src/netx/alarm-push.ts'

test('alarmSubscribeUrl maps http(s) REST roots to the hub path', () => {
  assert.equal(
    alarmSubscribeUrl('http://192.168.1.10:8890'),
    'ws://192.168.1.10:8890/v1/integrations/dsh-alarm/ws',
  )
  assert.equal(
    alarmSubscribeUrl('https://netx.example/'),
    'wss://netx.example/v1/integrations/dsh-alarm/ws',
  )
  assert.equal(alarmSubscribeUrl(''), '')
})

test('formatAlarmPrompt keeps human fields without raw sockets', () => {
  const text = formatAlarmPrompt({
    action: 'inserted',
    rule_label: 'Power Down',
    object_name: 'PORT-1',
    perceived_severity: 'critical',
    native_probable_cause: 'LOS',
    time_created: '2026-01-01T00:00:00Z',
    notification_id: 'n1',
    alarm_key: 'k1',
    ne: { host_name: 'PE1', ip_address: '10.0.0.1' },
  }, 'zh')
  assert.match(text, /告警产生/)
  assert.match(text, /PE1 \(10\.0\.0\.1\)/)
  assert.match(text, /请分析这条关键告警/)
})
