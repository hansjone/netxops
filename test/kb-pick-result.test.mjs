/**
 * Directory-picker Result unwrapping (mirrors controller helper).
 */

import assert from 'node:assert/strict'
import test from 'node:test'

function unwrapDirectoryPickResult(result) {
  if (result === null) return null
  if (typeof result === 'string') {
    const trimmed = result.trim()
    return trimmed === '' ? null : trimmed
  }
  if (typeof result !== 'object' || Array.isArray(result)) return undefined
  const row = result
  if (row.ok === false) {
    throw new Error(row.error?.message || 'directoryPicker/pick failed')
  }
  if ('value' in row) {
    if (row.value === null) return null
    if (typeof row.value === 'string') {
      const trimmed = row.value.trim()
      return trimmed === '' ? null : trimmed
    }
    return undefined
  }
  return undefined
}

test('unwrap bare string path', () => {
  assert.equal(unwrapDirectoryPickResult('D:\\kb'), 'D:\\kb')
})

test('unwrap typert Result value', () => {
  assert.equal(unwrapDirectoryPickResult({ ok: true, value: 'D:\\kb\\ioh' }), 'D:\\kb\\ioh')
})

test('unwrap cancel null', () => {
  assert.equal(unwrapDirectoryPickResult(null), null)
  assert.equal(unwrapDirectoryPickResult({ ok: true, value: null }), null)
})

test('reject Result error', () => {
  assert.throws(
    () => unwrapDirectoryPickResult({ ok: false, error: { message: 'no native' } }),
    /no native/,
  )
})
