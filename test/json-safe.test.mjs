/**
 * Lossless JSON helpers for DSH tool results.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { omitUndefined, toLosslessJson } from '../src/netx/json-safe.ts'

test('omitUndefined drops undefined keys but keeps null/false/0', () => {
  assert.deepEqual(
    omitUndefined({ a: 1, b: undefined, c: null, d: false, e: 0 }),
    { a: 1, c: null, d: false, e: 0 },
  )
})

test('toLosslessJson strips undefined holes (listBizMonitors-style payload)', () => {
  const raw = {
    ok: true,
    data: {
      kind: 'projects',
      projects: [{ id: 'p1', name: 'demo' }],
      tasks: undefined,
      next: 'go',
    },
  }
  const safe = toLosslessJson(raw)
  assert.equal(safe.ok, true)
  const data = safe.data
  assert.ok(data && typeof data === 'object' && !Array.isArray(data))
  assert.equal(Object.hasOwn(data, 'tasks'), false)
  assert.deepEqual(data.projects, [{ id: 'p1', name: 'demo' }])
})

test('toLosslessJson keeps failure envelopes serializable', () => {
  const safe = toLosslessJson({ ok: false, error: 'x', detail: undefined })
  assert.equal(safe.ok, false)
  assert.equal(safe.error, 'x')
  assert.equal(Object.hasOwn(safe, 'detail'), false)
})
