import test from 'node:test'
import assert from 'node:assert/strict'
import { CardForm, booleanFieldPersistFalse, textField, presetIdsField } from '../src/client/card-form.ts'

function formScope(options = {}) {
  const value = { groupOpsPublic: false, groupOpsPresets: 'standard', apiUrl: 'http://saved' }
  const listeners = new Set(), writes = []
  const scope = { getSnapshot: () => ({ status: 'ready', writable: true, value, base: { ...value }, user: { ...value } }),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    async set(field, next) {
      writes.push([field, next]); await options.beforeWrite?.()
      if (options.fail) throw new Error('save failed')
      value[field] = next; for (const fn of listeners) fn()
    }, async unset(field) { delete value[field] } }
  return { scope, value, writes }
}
const specs = [booleanFieldPersistFalse('groupOpsPublic'), textField('apiUrl'), presetIdsField('groupOpsPresets')]

test('publication autosave does not commit unrelated drafts', async () => {
  const { scope, value, writes } = formScope()
  const form = new CardForm(scope, specs), actions = form.actions()
  actions.edit('apiUrl', 'http://draft')
  actions.edit('groupOpsPublic', 'true')
  await form.save(['groupOpsPublic'])
  assert.equal(value.apiUrl, 'http://saved')
  assert.equal(form.field('apiUrl').text, 'http://draft')
  assert.deepEqual(writes, [['groupOpsPublic', true]])
  assert.equal(form.shell().dirty, true)
})

test('rapid on then off saves the latest edit without losing it', async () => {
  let resolveWrite, started
  const ready = new Promise(resolve => { started = resolve })
  const gate = new Promise(resolve => { resolveWrite = resolve })
  let first = true
  const { scope, value, writes } = formScope({ beforeWrite: async () => { if (first) { first = false; started(); await gate } } })
  const form = new CardForm(scope, specs), actions = form.actions()
  actions.edit('groupOpsPublic', 'true')
  const one = form.save(['groupOpsPublic'])
  await ready
  actions.edit('groupOpsPublic', 'false')
  const two = form.save(['groupOpsPublic'])
  resolveWrite()
  await Promise.all([one, two])
  assert.deepEqual(writes, [['groupOpsPublic', true], ['groupOpsPublic', false]])
  assert.equal(value.groupOpsPublic, false)
  assert.equal(form.shell().dirty, false)
})

test('write failure releases saving state and retains draft for retry', async () => {
  const options = { fail: true }, { scope, value } = formScope(options)
  const form = new CardForm(scope, specs)
  form.actions().edit('groupOpsPublic', 'true')
  await form.save(['groupOpsPublic'])
  assert.equal(form.shell().saving, false)
  assert.equal(form.shell().failed, true)
  assert.equal(form.shell().dirty, true)
  options.fail = false
  await form.save(['groupOpsPublic'])
  assert.equal(value.groupOpsPublic, true)
  assert.equal(form.shell().failed, false)
})

test('empty target selection persists an explicit override', async () => {
  const { scope, value, writes } = formScope()
  const form = new CardForm(scope, specs)
  form.actions().edit('groupOpsPresets', '')
  await form.save(['groupOpsPresets'])
  assert.equal(value.groupOpsPresets, '')
  assert.deepEqual(writes, [['groupOpsPresets', '']])
})
