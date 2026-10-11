import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFile(resolve(root, path), 'utf8')

test('package declares Desktop 0.2 client contract', async () => {
  const pkg = JSON.parse(await read('package.json'))
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/)
  assert.equal(pkg.engines.node, '>=20')
  assert.equal(pkg.dsh.client.immediately, false)
  assert.deepEqual(pkg.dsh.client.inject, [
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-locale',
  ])
  assert.ok(!pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-runtime'))
  assert.equal(pkg.exports['./cordis.patch.yml'], './cordis.bundle.patch.yml')
  assert.ok(!pkg.files.includes('lib/agent-tools-shared.js'))
  for (const name of [
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-credentials',
    '@deepseek-ai/dsh-settings',
    '@deepseek-ai/dsh-tools',
    '@deepseek-ai/schemastery',
  ]) {
    assert.equal(pkg.peerDependencies[name], '*', `${name} should be open peer *`)
  }
})

test('agent-tools entries are self-contained (no shared chunk)', async () => {
  for (const name of [
    'agent-tools.js',
    'agent-tools-ops.js',
    'agent-tools-nms.js',
    'agent-tools-common.js',
    'agent-tools-topology.js',
    'agent-tools-biz-monitor.js',
  ]) {
    const entry = await read(`lib/${name}`)
    assert.doesNotMatch(entry, /agent-tools-shared/)
    assert.match(entry, /applyGroupToolsPlugin|function apply/)
    const info = await stat(resolve(root, `lib/${name}`))
    assert.ok(info.size > 20_000, `${name} should be a full bundle, got ${info.size}`)
  }
})

test('browser half uses deferred configForms and distinct section id', async () => {
  const client = await read('lib/client.js')
  assert.match(client, /name:\s*["']settings\.section["']/)
  assert.match(client, /NETXOPS_SECTION_ID\s*=\s*["']dsh-netxops["']/)
  assert.match(client, /NETXOPS_NS\s*=\s*["']netxops["']/)
  assert.match(client, /id:\s*NETXOPS_SECTION_ID/)
  assert.match(client, /configForms poll/)
  assert.match(client, /createDeferredScope/)
  assert.match(client, /tools\.status|TOOLS_STATUS_ENDPOINT|toolsStatus/)
  assert.doesNotMatch(client, /inject\(\[["']configForms["']\]/)
  assert.doesNotMatch(client, /inject\(\[["']settingsScope["']\]/)
  assert.match(client, /name:\s*["']settings\.plugin\.item["']/)
  assert.match(client, /key:\s*id/)
  assert.doesNotMatch(client, /name:\s*["']plugins\.item["']/)
  assert.doesNotMatch(client, /dsh-client-runtime/)
  assert.doesNotMatch(client, /mcpServers|python -m netx_mcp/)
})

test('host Config marks scalar fields volatile for 0.2 projection', async () => {
  const host = await read('lib/index.js')
  assert.match(host, /function vol\(/)
  assert.match(host, /\.volatile\s*\(/)
  assert.match(host, /NETXOPS_SETTINGS_NAMESPACE\s*=\s*["']netxops["']/)
  assert.match(host, /document-updated/)
  assert.match(host, /normalizeApiUrl/)
  assert.match(host, /mergeHostConfigForHeal/)
  assert.match(host, /writePatchIfUnchanged/)
  assert.match(host, /groupOpsPublic:\s*vol\(z\.boolean\(\)\.default\(false\)\)/)
  assert.doesNotMatch(host, /inject\(\[["']settingsScope["']\]/)
})

test('client validates apiUrl and defaults ops public off', async () => {
  const client = await read('lib/client.js')
  assert.match(client, /apiUrlField\s*\(/)
  assert.match(client, /apiUrlInvalid/)
  assert.match(client, /groupOpsPublic:\s*false/)
  assert.match(client, /booleanFieldPersistFalse\s*\(\s*["']groupOpsPublic["']\s*\)/)
})

test('tools plugin subscribes before first remount (connection race)', async () => {
  const tools = await read('lib/agent-tools.js')
  const watchIdx = tools.indexOf('watchNetxConnection')
  const remountIdx = tools.indexOf('remountTools()')
  assert.ok(watchIdx >= 0 && remountIdx >= 0)
  assert.ok(
    watchIdx < remountIdx,
    'watchNetxConnection must be registered before the first remountTools()',
  )
  assert.match(tools, /setInterval/)
  assert.match(tools, /requireNetxConnection|provisionalNetxConnection/)
})

test('host hard-injects tools; soft credentials + provisional publish', async () => {
  const host = await read('lib/index.js')
  assert.match(host, /inject\s*=\s*\[\s*["']tools["']\s*\]/)
  assert.match(host, /provisional connection published/)
  assert.match(host, /plane:\s*["']host["']/)
  assert.match(host, /tools\.status/)
  assert.match(host, /netxops-mount-status\.json/)
  assert.match(host, /additionalProperties:\s*!0|additionalProperties:\s*true/)
  assert.match(host, /inject\(\[["']credentials["']\]/)
  assert.doesNotMatch(host, /export const inject = \[["']credentials["']\]/)
})
