import test from 'node:test'
import assert from 'node:assert/strict'
import { createWaitingSettingsScope, findReadySettingsForm } from '../src/client/settings-form.ts'
import { CardForm, booleanFieldPersistFalse } from '../src/client/card-form.ts'

test('unconnected settings cannot report a successful local-only publication save', async () => {
  const scope = createWaitingSettingsScope({ toolsEnabled: true })
  const form = new CardForm(scope, [booleanFieldPersistFalse('toolsEnabled')])
  assert.equal(form.shell().available, false)
  assert.equal(form.shell().writable, false)
  form.actions().edit('toolsEnabled', 'false')
  await form.save(['toolsEnabled'])
  assert.equal(scope.getSnapshot().value.toolsEnabled, true)
  assert.equal(form.shell().failed, true)
  assert.equal(form.shell().dirty, true)
  await assert.rejects(scope.set('toolsEnabled', false), /settings_transport_unavailable/)
})

test('form selection ignores unknown namespace placeholders and waits for the real namespace', () => {
  let ready = false
  const actual = { getSnapshot: () => ({ status: ready ? 'ready' : 'loading', writable: ready }) }
  const placeholder = { getSnapshot: () => ({ status: 'unavailable', writable: false }) }
  const forms = { get(id) { return id === 'netxops' ? actual : placeholder } }
  assert.equal(findReadySettingsForm(forms, ['client-entry-id', 'netxops', 'dsh-netxops']), undefined)
  ready = true
  assert.deepEqual(findReadySettingsForm(forms, ['client-entry-id', 'netxops', 'dsh-netxops']), { ns: 'netxops', scope: actual })
})
