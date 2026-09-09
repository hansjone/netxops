import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  alarmActionLabel,
  normalizeNetxLocale,
  tHost,
} from '../src/netx/i18n.ts'
import { getSessionsExportStatus } from '../src/netx/session-export.ts'

test('normalizeNetxLocale defaults to zh and accepts en tags', () => {
  assert.equal(normalizeNetxLocale(undefined), 'zh')
  assert.equal(normalizeNetxLocale(''), 'zh')
  assert.equal(normalizeNetxLocale('zh-CN'), 'zh')
  assert.equal(normalizeNetxLocale('en'), 'en')
  assert.equal(normalizeNetxLocale('en-US'), 'en')
  assert.equal(normalizeNetxLocale('english'), 'en')
})

test('tHost localizes alarm session titles', () => {
  assert.equal(tHost('alarm.sessionTitle', 'zh'), 'Netx 关键告警')
  assert.equal(tHost('alarm.sessionTitle', 'en'), 'Netx key alarm')
  assert.equal(alarmActionLabel('inserted', 'en'), 'Alarm Raised')
})

test('getSessionsExportStatus returns reasonCode for UI i18n', async () => {
  const missing = await getSessionsExportStatus({ get: () => undefined })
  assert.equal(missing.available, false)
  assert.equal(missing.reasonCode, 'no_persistence')

  const noRaw = await getSessionsExportStatus({
    get: () => ({
      supportsRawArtifacts: false,
      list: async () => [],
      readRaw: async () => undefined,
    }),
  })
  assert.equal(noRaw.reasonCode, 'no_raw_artifacts')
})
