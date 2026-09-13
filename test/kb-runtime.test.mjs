/**
 * KB runtime env mirroring.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveKbRoot } from '../src/netx/kb-manifest.ts'
import { applyKbEnv, getKbContext, publishKbContext, resetKbContext } from '../src/netx/kb-runtime.ts'

test('applyKbEnv clears identity when unconfigured', () => {
  process.env.KB_ROOT = '/tmp/x'
  process.env.KB_OPERATOR = 'IOH'
  applyKbEnv(resolveKbRoot(''))
  assert.equal(process.env.KB_STATUS, 'unconfigured')
  assert.equal(process.env.KB_ROOT, undefined)
  assert.equal(process.env.KB_OPERATOR, undefined)
  resetKbContext()
})

test('publishKbContext updates store', () => {
  publishKbContext({
    status: 'configured',
    realRoot: '/kb',
    operatorName: 'IOH',
    country: 'ID',
    version: '1',
    content: {
      hasRegions: true,
      hasTheory: false,
      hasPacket: false,
      hasCommon: false,
      hasSkills: false,
    },
    errorMessage: '',
  })
  const snap = getKbContext()
  assert.equal(snap.status, 'configured')
  assert.equal(snap.operatorName, 'IOH')
  applyKbEnv(snap)
  assert.equal(process.env.KB_OPERATOR, 'IOH')
  assert.equal(process.env.KB_COUNTRY, 'ID')
  assert.ok(process.env.KB_CONTENT?.includes('"hasRegions":true'))
  assert.equal(process.env.KB_CONTENT?.includes('"regions"'), false)
  resetKbContext()
})
