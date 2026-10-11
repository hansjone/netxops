import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { composeNetxopsPresetArtifacts, hostResolveBases, installDirectoryPreset, resolveActiveProfile, resolveStandardPresetDir, syncDeclarativeIntoProfilePatch } from '../src/agent-preset-install.ts'

const log = { info() {}, warn() {}, error() {} }
const { load } = createRequire(import.meta.url)('js-yaml')
const patch = '- insert:\n    - id: preset-netxops\n      name: preset-plugin\n'
function home(t) {
  const previous = process.env.DSH_HOME
  const root = mkdtempSync(join(tmpdir(), 'netxops-install-'))
  process.env.DSH_HOME = root
  t.after(() => { if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous })
  return root
}
const artifacts = { standardSource: 'fixture', standardKind: 'desktop-patch', standardDir: null,
  agentCordis: '- id: netxops-tools\n  name: dsh-netxops/tools\n', name: 'Netx Ops', description: '', order: '50', declarativePatch: patch }

test('updating Desktop patch leaves Web patch intact', t => {
  const root = home(t)
  for (const profile of ['desktop', 'web']) {
    mkdirSync(join(root, 'profiles', profile), { recursive: true })
    writeFileSync(join(root, 'profiles', profile, 'cordis.patch.yml'), '# user configuration\n[]\n')
  }
  const web = join(root, 'profiles', 'web', 'cordis.patch.yml'), original = readFileSync(web, 'utf8')
  syncDeclarativeIntoProfilePatch('desktop', patch, log)
  assert.equal(readFileSync(web, 'utf8'), original)
  assert.match(readFileSync(join(root, 'profiles', 'desktop', 'cordis.patch.yml'), 'utf8'), /preset-netxops/)
  assert.equal(load(readFileSync(join(root, 'profiles', 'desktop', 'cordis.patch.yml'), 'utf8'))[0].insert[0].id, 'preset-netxops')
})

test('fresh commented and delimited profile patches remain valid after install and upgrade', t => {
  const root = home(t)
  for (const [index, original] of [
    '# Your patch layer\n[]\n',
    '\uFEFF# profile\r\n[] # empty\r\n',
    '---\n# profile\n[]\n...\n',
    '# user config\n- id: preserve-me\n  config: {value: 7}\n...\n',
  ].entries()) {
    const profile = `custom-${index}`, folder = join(root, 'profiles', profile)
    mkdirSync(folder, { recursive: true })
    const path = join(folder, 'cordis.patch.yml')
    writeFileSync(path, original)
    syncDeclarativeIntoProfilePatch(profile, patch, log)
    const first = readFileSync(path, 'utf8'), rows = load(first)
    assert.ok(Array.isArray(rows))
    assert.equal(rows.filter(row => row.insert?.[0]?.id === 'preset-netxops').length, 1)
    if (index === 3) assert.equal(rows[0].config.value, 7)
    syncDeclarativeIntoProfilePatch(profile, patch, log)
    assert.equal(readFileSync(path, 'utf8'), first, 'upgrade is idempotent')
  }
})

test('quoted or commented user preset IDs are preserved and unsupported roots are not overwritten', t => {
  const root = home(t), folder = join(root, 'profiles', 'web')
  mkdirSync(folder, { recursive: true })
  const path = join(folder, 'cordis.patch.yml')
  for (const id of ['preset-netxops # custom', '"preset-netxops"', "'preset-netxops'"]) {
    const original = `- insert:\n    - id: ${id}\n      name: custom-preset\n`
    writeFileSync(path, original)
    syncDeclarativeIntoProfilePatch('web', patch, log)
    assert.equal(readFileSync(path, 'utf8'), original)
  }
  writeFileSync(path, 'config: user-data\n')
  assert.throws(() => syncDeclarativeIntoProfilePatch('web', patch, log), /preserving/)
  assert.equal(readFileSync(path, 'utf8'), 'config: user-data\n')
  assert.throws(() => syncDeclarativeIntoProfilePatch('../outside', patch, log), /invalid/)
})

test('unterminated managed block does not truncate user configuration', t => {
  const root = home(t), folder = join(root, 'profiles', 'web')
  mkdirSync(folder, { recursive: true })
  const path = join(folder, 'cordis.patch.yml')
  const original = '# BEGIN dsh-netxops-preset (managed)\n- id: preserve-me\n'
  writeFileSync(path, original)
  assert.throws(() => syncDeclarativeIntoProfilePatch('web', patch, log), /unterminated/)
  assert.equal(readFileSync(path, 'utf8'), original)
})

test('unmanaged preset declaration remains authoritative', t => {
  const root = home(t), folder = join(root, 'profiles', 'web')
  mkdirSync(folder, { recursive: true })
  const path = join(folder, 'cordis.patch.yml'), original = '- insert:\n    - id: preset-netxops\n      name: custom-preset\n'
  writeFileSync(path, original)
  syncDeclarativeIntoProfilePatch('web', patch, log)
  assert.equal(readFileSync(path, 'utf8'), original)
})

test('managed directory update preserves edits and extra files', t => {
  const root = home(t), folder = join(root, '.agent-presets', 'netxops')
  installDirectoryPreset(artifacts, log)
  writeFileSync(join(folder, 'notes.md'), 'user notes')
  writeFileSync(join(folder, 'agent.cordis.yml'), '- id: user-edited\n')
  installDirectoryPreset({ ...artifacts, agentCordis: '- id: updated\n' }, log)
  assert.equal(readFileSync(join(folder, 'notes.md'), 'utf8'), 'user notes')
  assert.equal(readFileSync(join(folder, 'agent.cordis.yml'), 'utf8'), '- id: user-edited\n')
  assert.equal(existsSync(join(folder, 'skills')), false, 'runtime-controlled skills are not copied into auto-scanned roots')
})

test('profile identity follows the running profile path', () => {
  const previous = process.env.DSH_PROFILE
  delete process.env.DSH_PROFILE
  try {
    assert.equal(resolveActiveProfile('file:///C:/dsh/profiles/desktop/cordis.yml'), 'desktop')
    assert.equal(resolveActiveProfile('C:\\dsh\\profiles\\web\\cordis.yml'), 'web')
  } finally { if (previous !== undefined) process.env.DSH_PROFILE = previous }
})

test('fresh install overlays the seeded standard composition', t => {
  const root = home(t), standard = join(root, 'standard')
  mkdirSync(standard)
  writeFileSync(join(standard, 'agent.cordis.yml'), '- id: standard-only\n')
  installDirectoryPreset({ ...artifacts, standardDir: standard }, log)
  assert.equal(readFileSync(join(root, '.agent-presets', 'netxops', 'agent.cordis.yml'), 'utf8'), artifacts.agentCordis)
})

test('each Host resolves its own standard before shared dependencies', t => {
  const root = home(t)
  for (const profile of ['desktop', 'web']) {
    const folder = join(root, 'profiles', profile, 'node_modules', '@deepseek-ai', 'dsh-agent-presets', 'presets', 'standard')
    mkdirSync(folder, { recursive: true })
    writeFileSync(join(folder, 'agent.cordis.yml'), `- id: ${profile}\n`)
    writeFileSync(join(root, 'profiles', profile, 'package.json'), '{}')
    assert.equal(resolveStandardPresetDir(profile), folder)
    const other = profile === 'desktop' ? 'web' : 'desktop'
    assert.equal(hostResolveBases(profile).some(path => path.startsWith(join(root, 'profiles', other))), false)
  }
})

test('runtime composition preserves the Host standard dialect and workflow engine', t => {
  home(t)
  const original = "- id: tool-fs\n  name: '@host-only/fs'\n  disabled: !!js process.platform === 'win32'\n- id: workflow-worker-thread\n  name: '@deepseek-ai/dsh-workflow-worker-thread'\n"
  const composed = composeNetxopsPresetArtifacts('web', original)
  assert.equal(composed.standardKind, 'host-registry')
  assert.match(composed.agentCordis, /@host-only\/fs/)
  assert.match(composed.agentCordis, /disabled: !!js process.platform === 'win32'/)
  assert.match(composed.agentCordis, /workflow-worker-thread/)
  assert.doesNotMatch(composed.agentCordis, /workflow-ptc/)
  assert.match(composed.agentCordis, /name: dsh-netxops\/tools/)
  assert.match(composed.agentCordis, /- id: persona/)
})
