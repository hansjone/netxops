import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeApiUrl } from '../src/netx/http.ts'
import { alarmSubscribeUrl } from '../src/netx/alarm-push.ts'

test('normalizeApiUrl accepts http(s) roots and strips trailing slash', () => {
  assert.deepEqual(normalizeApiUrl('http://127.0.0.1:8890/'), {
    ok: true,
    url: 'http://127.0.0.1:8890',
  })
  assert.deepEqual(normalizeApiUrl('https://netx.example.com/api/'), {
    ok: true,
    url: 'https://netx.example.com/api',
  })
  assert.deepEqual(normalizeApiUrl('  http://192.168.1.10:8890  '), {
    ok: true,
    url: 'http://192.168.1.10:8890',
  })
})

test('normalizeApiUrl rejects empty, bad schemes, and credentials-in-URL', () => {
  assert.equal(normalizeApiUrl('').error, 'empty')
  assert.equal(normalizeApiUrl('not a url').error, 'invalid_url')
  assert.equal(normalizeApiUrl('file:///etc/passwd').error, 'unsupported_scheme')
  assert.equal(normalizeApiUrl('javascript:alert(1)').error, 'unsupported_scheme')
  assert.equal(normalizeApiUrl('http://user:pass@127.0.0.1:8890').error, 'credentials_in_url')
})

test('alarmSubscribeUrl only promotes http(s) to ws(s)', () => {
  assert.equal(
    alarmSubscribeUrl('http://127.0.0.1:8890'),
    'ws://127.0.0.1:8890/v1/integrations/dsh-alarm/ws',
  )
  assert.equal(
    alarmSubscribeUrl('https://netx.example.com/'),
    'wss://netx.example.com/v1/integrations/dsh-alarm/ws',
  )
  assert.equal(alarmSubscribeUrl('file:///tmp'), '')
  assert.equal(alarmSubscribeUrl('http://user:secret@127.0.0.1:8890'), '')
  assert.equal(alarmSubscribeUrl(''), '')
})
