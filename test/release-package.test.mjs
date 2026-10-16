import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import vm from 'node:vm'
import { checkBuilds } from '../scripts/build-integrity.mjs'
import { npmRuntime } from '../scripts/npm-cli.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const { node, npm } = npmRuntime()
/** Inlined into the activate smoke so the packed Host can register without netx. */
const OPS_TOOL_NAMES_INLINE = [
  'queryNmsAlarms', 'aggregateNmsAlarms', 'runNmsDiagnostics', 'queryNmsNeInventory', 'getNmsNe',
  'queryNmsAlarmsRaw', 'aggregateNmsAlarmsRaw', 'listNmsAlarmFields', 'sqlQueryNms',
  'listManagedNe', 'getManagedNe', 'execManagedNe', 'getNeExecJob', 'listCliTargets', 'findTopologyPaths',
]
const run = (args, cwd, env = {}) => {
  const result = spawnSync(node, args, { cwd, env: { ...process.env, ...env }, encoding: 'utf8', windowsHide: true, timeout: 120_000 })
  assert.equal(result.status, 0, `${args[0]} failed: ${result.error ?? ''}\n${result.stderr}\n${result.stdout}`)
  return result.stdout
}
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'netxops-release-'))
  t.after(() => {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()), 'Cleanup must stay in the temporary fixture.')
    assert.ok(dirname(directory) !== directory && directory.includes('netxops-release-'))
    rmSync(directory, { recursive: true, force: true })
  })
  return directory
}

test('the npm tarball installs offline and supplies every exported artifact and skill', async t => {
  const directory = fixture(t), cache = join(directory, 'cache')
  const packed = JSON.parse(run([npm, 'pack', '--json', '--ignore-scripts', '--pack-destination', directory, '--cache', cache], root))[0]
  const names = new Set(packed.files.map(file => file.path))
  for (const path of Object.values(pkg.exports).filter(path => !path.includes('*'))) assert.ok(names.has(path.slice(2)), `Missing packed export ${path}`)
  for (const path of ['icon.svg', 'locale/en.json', 'locale/zh.json', pkg.dsh.bundle.patch.slice(2),
    'presets/netxops/PERSONA.md', 'presets/netxops/preset.yml',
    'presets/netxops/skills/ops/netx-ops/SKILL.md',
    'presets/netxops/skills/topology/netx-topology/SKILL.md',
    'presets/netxops/skills/biz-monitor/netx-biz-monitor/SKILL.md',
  ]) assert.ok(names.has(path), `Missing packed resource ${path}`)
  for (const path of names) assert.doesNotMatch(path, /^(?:src|test|tests|examples|scripts|node_modules)\/|\.env|\.npmrc/, `Private/developer file included: ${path}`)
  const profile = join(directory, '全新安装 profile with spaces')
  mkdirSync(profile)
  writeFileSync(join(profile, 'package.json'), JSON.stringify({ name: 'isolated-netxops-profile', private: true }))
  // Deliberately allow lifecycle scripts: a normal install must not invoke a build.
  run([npm, 'install', '--offline', '--omit=dev', '--no-audit', '--no-fund', '--cache', cache, join(directory, packed.filename)], profile)
  const installed = join(profile, 'node_modules', pkg.name)
  assert.equal(lstatSync(installed).isSymbolicLink(), false, 'Must test a real package copy, not the developer checkout.')
  assert.equal(existsSync(join(profile, 'node_modules', '@deepseek-ai')), false, 'Installation must not fetch private Harness packages.')
  assert.equal(existsSync(join(profile, 'node_modules', 'react')), false)
  for (const path of Object.values(pkg.exports).filter(path => path.endsWith('.js'))) run(['--check', join(installed, path)], profile)
  let client
  vm.runInNewContext(readFileSync(join(installed, 'lib/client.js'), 'utf8'), { window: { __ModuleLoader__: { load(value) { client = value } } } })
  assert.equal(client.id, pkg.name)
  assert.equal(typeof client.factory, 'function')
  const api = client.factory(name => { assert.ok(['react', 'react/jsx-runtime'].includes(name)); return {} })
  assert.equal(typeof api.apply, 'function')

  {
    const dshHome = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
    const anchors = [process.env.NETXOPS_HOST_PACKAGE_JSON,
      join(dshHome, 'profiles', 'desktop', 'package.json'), join(dshHome, 'profiles', 'web', 'package.json'),
      join(dshHome, 'profiles', 'node_modules', '@deepseek-ai', 'dsh-web-app', 'package.json'),
    ].filter(Boolean).filter(existsSync)
    let peers
    for (const anchor of anchors) {
      try {
        const req = createRequire(anchor)
        peers = Object.fromEntries(Object.keys(pkg.peerDependencies).filter(name => name.startsWith('@deepseek-ai/')).map(name => [name, pathToFileURL(req.resolve(name)).href]))
        break
      } catch { /* Try a complete Host generation, never mix peers. */ }
    }
    if (!peers) { console.log('No installed Harness runtime: offline installation verified; Host activation requires a local Harness.'); return }
    // A neighboring package must never override the skills shipped to users.
    const trap = join(profile, 'node_modules', 'netx', 'skills', 'ops', 'netx-ops')
    mkdirSync(trap, { recursive: true })
    writeFileSync(join(trap, 'SKILL.md'), '---\nname: unexpected-neighbor\ndescription: Must not load\n---\nwrong package')
    const loader = join(directory, 'host-loader.mjs')
    writeFileSync(loader, `let peers; export function initialize(data) { peers = data }
      export async function resolve(name, ctx, next) { return peers[name] ? { url: peers[name], shortCircuit: true } : next(name, ctx) }`)
    const smoke = join(directory, 'activate-installed.mjs')
    writeFileSync(smoke, `import assert from 'node:assert/strict'; import { register } from 'node:module';
      register(${JSON.stringify(pathToFileURL(loader).href)}, { data: ${JSON.stringify(peers)} });
      const { Context, Service } = await import('@deepseek-ai/cordis');
      const host = await import(${JSON.stringify(pathToFileURL(join(installed, 'lib/index.js')).href)});
      const root = new Context(), tools = new Map(), skills = new Map(), owners = [];
      class Tools extends Service { constructor(ctx) { super(ctx, 'tools') } register(entry) { assert.ok(!tools.has(entry.name)); tools.set(entry.name, entry); return () => tools.delete(entry.name) } }
      class Skills extends Service { constructor(ctx) { super(ctx, 'skills') } register(entry) { assert.ok(!skills.has(entry.name)); skills.set(entry.name, entry); return () => skills.delete(entry.name) } }
      // Seed a cached /mcp catalog so host registration does not need a live netx.
      const STORE = Symbol.for('dsh-netxops.mcp-catalog-store');
      const ops = ${JSON.stringify([...OPS_TOOL_NAMES_INLINE])};
      globalThis[STORE] = { generation: 1, listeners: new Set(), state: {
        phase: 'connected', mcpUrl: 'http://127.0.0.1:8890/mcp', error: '', listedAt: new Date().toISOString(), fromCache: false,
        tools: ops.map(name => ({ name, description: name, inputSchema: { type: 'object', properties: {} },
          readOnlyHint: name !== 'execManagedNe', group: 'ops' })),
      } };
      owners.push(await root.plugin(Tools), await root.plugin(Skills));
      const owner = await root.plugin(host, { installAgentPreset: false, alarmPushEnabled: false, groupOpsPublic: true }); owners.push(owner);
      assert.equal(owner.state, 2); assert.equal(tools.size, 15);
      await new Promise(resolve => setTimeout(resolve, 80));
      assert.ok(skills.has('netx-ops')); assert.equal(skills.has('unexpected-neighbor'), false);
      assert.ok(skills.get('netx-ops').path.startsWith(${JSON.stringify(installed)}));
      for (const path of ${JSON.stringify(Object.values(pkg.exports).filter(path => path.endsWith('.js') && path !== './lib/client.js'))}) {
        const api = await import(new URL(path, ${JSON.stringify(pathToFileURL(join(installed, 'package.json')).href)})); assert.equal(typeof api.apply, 'function');
      }
      for (const owner of owners.reverse()) await owner.dispose();
      await new Promise(resolve => setTimeout(resolve, 40)); assert.equal(tools.size, 0); assert.equal(skills.size, 0);
      console.log('Installed Host active: 15 tools, bundled ops skill, clean unload.');`)
    run([smoke], profile, { DSH_HOME: join(directory, 'isolated-dsh-home'), NETX_SKILLS_ROOT: '' })
  }
})

test('the release gate rejects modified or stale precompiled files', t => {
  const directory = fixture(t)
  const manifest = JSON.parse(readFileSync(join(root, '.release-build.json'), 'utf8'))
  const paths = new Set(['package.json', '.release-build.json', ...Object.keys(manifest.builds),
    ...Object.values(manifest.builds).flatMap(build => Object.keys(build.inputs))])
  for (const path of paths) { mkdirSync(dirname(join(directory, path)), { recursive: true }); cpSync(join(root, path), join(directory, path)) }
  assert.equal(checkBuilds(directory).length, 8)
  const output = join(directory, 'lib/index.js')
  writeFileSync(output, `${readFileSync(output, 'utf8')}\n// unverified change`)
  assert.throws(() => checkBuilds(directory), /modified artifact/)
  cpSync(join(root, 'lib/index.js'), output)
  const source = join(directory, 'src/index.ts')
  writeFileSync(source, `${readFileSync(source, 'utf8')}\n// source changed after building`)
  assert.throws(() => checkBuilds(directory), /Stale artifact/)
})
