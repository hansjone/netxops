import test from 'node:test'
import assert from 'node:assert/strict'
import { apiUrlField } from '../src/client/card-form.ts'

test('apiUrlField accepts http(s) and normalizes trailing slash', () => {
  const field = apiUrlField('apiUrl')
  assert.deepEqual(field.parse('http://127.0.0.1:8890/'), {
    kind: 'set',
    value: 'http://127.0.0.1:8890',
  })
  assert.deepEqual(field.parse(''), { kind: 'clear' })
})

test('apiUrlField rejects unsafe URLs', () => {
  const field = apiUrlField('apiUrl')
  assert.equal(field.parse('file:///tmp'), undefined)
  assert.equal(field.parse('http://user:pass@h/'), undefined)
  assert.equal(field.parse('not-a-url'), undefined)
})
