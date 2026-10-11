import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  mergeHostConfigForHeal,
  NETXOPS_HOST_CONFIG_DEFAULTS,
  writePatchIfUnchanged,
} from '../src/netx/heal-profile-entry.ts'

test('mergeHostConfigForHeal fills missing defaults only', () => {
  const merged = mergeHostConfigForHeal({
    apiUrl: 'http://custom:8890',
    groupOpsPublic: false,
  })
  assert.equal(merged.apiUrl, 'http://custom:8890')
  assert.equal(merged.groupOpsPublic, false)
  assert.equal(merged.lang, NETXOPS_HOST_CONFIG_DEFAULTS.lang)
  assert.equal(merged.tokenCredentialRef, NETXOPS_HOST_CONFIG_DEFAULTS.tokenCredentialRef)
  assert.equal(merged.groupBizMonitorInPreset, NETXOPS_HOST_CONFIG_DEFAULTS.groupBizMonitorInPreset)
})

test('mergeHostConfigForHeal preserves unknown user keys', () => {
  const merged = mergeHostConfigForHeal({
    apiUrl: 'http://127.0.0.1:8890',
    customSiteTag: 'hq-edge-1',
  })
  assert.equal(merged.customSiteTag, 'hq-edge-1')
  assert.equal(merged.apiUrl, 'http://127.0.0.1:8890')
})

test('mergeHostConfigForHeal never overwrites empty-string user values with defaults', () => {
  const merged = mergeHostConfigForHeal({
    kbRoot: '',
    imBotId: '',
  })
  assert.equal(merged.kbRoot, '')
  assert.equal(merged.imBotId, '')
})

test('NETXOPS_HOST_CONFIG_DEFAULTS keeps ops public off', () => {
  assert.equal(NETXOPS_HOST_CONFIG_DEFAULTS.groupOpsPublic, false)
})

test('writePatchIfUnchanged aborts when file raced', () => {
  const dir = mkdtempSync(join(tmpdir(), 'netxops-heal-'))
  const path = join(dir, 'cordis.patch.yml')
  writeFileSync(path, 'v1\n', 'utf8')
  assert.equal(writePatchIfUnchanged(path, 'v1\n', 'v2\n'), true)
  assert.equal(readFileSync(path, 'utf8'), 'v2\n')
  // Caller still holds stale expectedRaw after another writer changed the file.
  writeFileSync(path, 'other\n', 'utf8')
  assert.equal(writePatchIfUnchanged(path, 'v2\n', 'v3\n'), false)
  assert.equal(readFileSync(path, 'utf8'), 'other\n')
})
