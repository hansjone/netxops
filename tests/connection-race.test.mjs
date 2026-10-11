import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getNetxConnection,
  publishNetxConnection,
  watchNetxConnection,
} from '../src/netx/runtime.ts'
import { DEFAULT_CAPABILITY_GROUPS } from '../src/netx/capability-groups.ts'

function clearConnection() {
  publishNetxConnection({
    apiUrl: '',
    token: '',
    lang: 'zh',
    toolCallTimeoutMs: 1000,
    groups: DEFAULT_CAPABILITY_GROUPS,
    groupKbInPreset: false,
    groupKbPublic: false,
  })
  // runtime has no reset — overwrite with a sentinel then ignore
}

test('watch-then-remount does not miss an in-flight publish', () => {
  let mounts = 0
  const remount = () => {
    if (getNetxConnection()?.apiUrl) mounts += 1
  }

  // Bad order (pre-0.1.58): remount → publish → watch → miss
  mounts = 0
  remount()
  publishNetxConnection({
    apiUrl: 'http://127.0.0.1:8890',
    token: 't',
    lang: 'zh',
    toolCallTimeoutMs: 1000,
    groups: DEFAULT_CAPABILITY_GROUPS,
    groupKbInPreset: true,
    groupKbPublic: false,
  })
  const stopBad = watchNetxConnection(remount)
  assert.equal(mounts, 0, 'bad order misses the publish')
  stopBad()

  // Good order: watch → publish → remount (and watch also fires)
  mounts = 0
  clearConnection()
  const stopGood = watchNetxConnection(remount)
  publishNetxConnection({
    apiUrl: 'http://127.0.0.1:8890',
    token: 't',
    lang: 'zh',
    toolCallTimeoutMs: 1000,
    groups: DEFAULT_CAPABILITY_GROUPS,
    groupKbInPreset: true,
    groupKbPublic: false,
  })
  remount()
  assert.ok(mounts >= 1, 'good order sees connection')
  stopGood()
})
