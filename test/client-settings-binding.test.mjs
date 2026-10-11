import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { Context, Service } from '@deepseek-ai/cordis'

const require = createRequire(import.meta.url)
// The shell seeds React from its own dependency tree, not the plugin's local
// development junction. Use that same installed peer tree for this built smoke.
const profileHome = process.env.DSH_HOME || join(homedir(), '.dsh')
const renderer = ['', 'desktop', 'web'].map(profile => join(profileHome, 'profiles', profile, 'node_modules',
  '@deepseek-ai', 'dsh-client-ui-renderer', 'package.json')).find(existsSync)
const sharedRequire = renderer ? createRequire(renderer) : require
function loadClient() {
  let client
  runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load({ factory }) { client = factory(spec =>
      spec === 'react' || spec.startsWith('react/') ? sharedRequire(spec) : require(spec)) } } },
    setTimeout, clearTimeout, setInterval, clearInterval, console, AbortController,
  })
  return client
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))

function hostForm() {
  let snapshot = { status: 'ready', writable: true, value: { toolsEnabled: true, groupOpsPresets: 'standard', apiUrl: 'http://127.0.0.1:8890' },
    user: {}, base: {}, revision: 1 }
  const listeners = new Set(), writes = []
  return {
    writes, getSnapshot: () => snapshot,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    async set(field, value) {
      writes.push([field, value])
      snapshot = { ...snapshot, value: { ...snapshot.value, [field]: value }, user: { ...snapshot.user, [field]: value }, revision: snapshot.revision + 1 }
      for (const fn of listeners) fn()
      return true
    },
    async unset(field) {
      const user = { ...snapshot.user }; delete user[field]
      snapshot = { ...snapshot, user, revision: snapshot.revision + 1 }
      for (const fn of listeners) fn()
      return true
    },
  }
}

async function fixture(t, legacy = false) {
  const root = new Context(), owners = [], slots = new Map(), actual = hostForm()
  class Slots extends Service {
    constructor(ctx) { super(ctx, 'slots') }
    inject(name, register) { return register() }
    register(spec) {
      const key = `${spec.name}:${spec.id ?? spec.key}`
      slots.set(key, spec)
      return () => slots.delete(key)
    }
  }
  class Locale extends Service {
    constructor(ctx) { super(ctx, 'locale') }
    register() { return () => {} }
    bind() { return key => key }
  }
  class Forms extends Service {
    constructor(ctx) { super(ctx, legacy ? 'settingsScope' : 'configForms') }
    get(id) { return id === 'netxops' ? actual : { getSnapshot: () => ({ status: 'unavailable', writable: false }) } }
    bind({ namespace }) { return this.get(namespace) }
    whileServed(ids, register) { return register(new Set(['netxops'])) }
  }
  t.after(async () => { for (const owner of owners.reverse()) await owner.dispose() })
  for (const Provider of [Slots, Locale, Forms]) owners.push(await root.plugin(Provider))
  const client = loadClient()
  const owner = await root.plugin({ ...client, name: 'netxops-client-binding' })
  owners.push(owner)
  return { root, owner, slots, actual }
}

test('built settings card uses optional lookup in real Cordis and saves through the Host form', async t => {
  const { owner, slots, actual } = await fixture(t)
  assert.equal(owner.state, 2 /* ACTIVE */)
  assert.throws(() => owner.ctx.configForms, /without inject/)
  const section = slots.get('settings.section:dsh-netxops')
  assert.ok(section)
  const face = section.inject()
  assert.equal(face.hooks.netxopsCard.getSnapshot().available, false)
  await pause(80)
  assert.equal(face.hooks.netxopsCard.getSnapshot().available, true)
  assert.equal(face.hooks.netxopsCard.getSnapshot().writable, true)
  assert.equal(face.hooks.netxopsCard.getSnapshot().groupOpsPresets.text, 'standard')
  face.edit('toolsEnabled', 'false')
  await pause(20)
  assert.deepEqual(actual.writes, [['toolsEnabled', false]])
  assert.equal(face.hooks.netxopsCard.getSnapshot().toolsEnabled.text, 'false')
  assert.ok(slots.has('settings.plugin.item:netxops'))
})

test('built settings card still follows the legacy Host settings scope', async t => {
  const { slots, actual } = await fixture(t, true)
  const face = slots.get('settings.section:dsh-netxops').inject()
  await pause(80)
  assert.equal(face.hooks.netxopsCard.getSnapshot().available, true)
  face.edit('groupOpsPresets', '')
  await pause(20)
  assert.deepEqual(actual.writes, [['groupOpsPresets', '']])
})
