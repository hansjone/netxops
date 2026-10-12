/**
 * KB loading: BOM MANIFEST, resolved path anchors, identity inlining, pack footer /
 * duplicate isolation, forced reload, and jailed read/search tools.
 */

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import test from 'node:test'

import { registerKbContextSkill } from '../src/netx/kb-context-skill.ts'
import { resolveKbPaths, resolveKbRoot } from '../src/netx/kb-manifest.ts'
import { registerKbLocalTools } from '../src/netx/kb-local-tools.ts'
import { registerKbPackSkills } from '../src/netx/kb-pack-skills.ts'
import { readKbFile, searchKb } from '../src/netx/kb-read-ops.ts'
import { applyKbEnv, publishKbContext, resetKbContext, watchKbContext } from '../src/netx/kb-runtime.ts'

const LOCAL = 'regions/ID/IOH/_local'
const BOM = String.fromCharCode(0xfeff)

function manifest() {
  return JSON.stringify({
    schemaVersion: '1.0',
    packageType: 'operator-subset',
    operator: { name: 'IOH', country: 'ID' },
    version: '2026.09-v31',
    content: { hasRegions: true, hasSkills: true },
    paths: {
      rca: 'regions/ID/IOH/00_有效RCA',
      local: LOCAL,
      localSkills: `${LOCAL}/local_skills`,
      neIndex: 'regions/ID/IOH/00_索引/网元索引.md',
      skills: '_skills',
    },
  }, null, 2)
}

function skill(dir, name) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${name} playbook\n---\n\n# ${name}\n`, 'utf8')
}

/** Minimal operator subset on disk; MANIFEST written with a UTF-8 BOM (PowerShell 5.1). */
async function withKb(run) {
  const root = mkdtempSync(join(tmpdir(), 'netxops-kb-load-'))
  const outside = `${root}-secret.md`
  try {
    writeFileSync(join(root, 'MANIFEST.json'), `${BOM}${manifest()}`, 'utf8')
    const rca = join(root, 'regions/ID/IOH/00_有效RCA/02_路由')
    mkdirSync(rca, { recursive: true })
    writeFileSync(join(rca, '20250911-MC-Aceh-Flap.md'), '# Aceh flap\n\n- 涉及网元 | MDN-BCP-CN1\n- BGP session flap\n', 'utf8')
    writeFileSync(join(rca, '20250101-other.md'), '# other\n\nISIS only\n', 'utf8')
    mkdirSync(join(root, 'regions/ID/IOH/00_索引'), { recursive: true })
    writeFileSync(join(root, 'regions/ID/IOH/00_索引/网元索引.md'), 'line1\nline2\nline3\n', 'utf8')
    mkdirSync(join(root, LOCAL, 'identity'), { recursive: true })
    writeFileSync(join(root, LOCAL, 'identity/README.md'), 'template only', 'utf8')
    writeFileSync(join(root, LOCAL, 'identity/话术与边界.md'), '不对外承诺恢复时间', 'utf8')
    skill(join(root, '_skills/kb-troubleshoot'), 'kb-troubleshoot')
    skill(join(root, '_skills/kb-retrieve'), 'kb-retrieve')
    skill(join(root, LOCAL, 'local_skills/kb-retrieve'), 'kb-retrieve')
    skill(join(root, LOCAL, 'local_skills/ioh-private'), 'ioh-private')
    writeFileSync(outside, 'outside', 'utf8')
    await run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
    rmSync(outside, { force: true })
  }
}

function fakeCtx() {
  const skills = new Map()
  const tools = new Map()
  const warnings = []
  // Mirrors DSH: registering an existing name throws.
  const register = map => (entry) => {
    if (map.has(entry.name)) throw new Error(`duplicate: ${entry.name}`)
    map.set(entry.name, entry)
    return () => { map.delete(entry.name) }
  }
  return {
    skills,
    tools,
    warnings,
    ctx: {
      logger: { info() {}, warn(...args) { warnings.push(args) }, error() {} },
      skills: { register: register(skills) },
      tools: { register: register(tools) },
    },
  }
}

test('MANIFEST with UTF-8 BOM resolves as configured', () => withKb((root) => {
  const kb = resolveKbRoot(root)
  assert.equal(kb.status, 'configured', kb.errorMessage)
  assert.equal(kb.version, '2026.09-v31')
}))

test('resolveKbPaths returns absolute anchors and KB_PATHS mirrors them', () => withKb((root) => {
  const kb = resolveKbRoot(root)
  const rows = Object.fromEntries(resolveKbPaths(kb).map(row => [row.key, row]))
  assert.equal(rows.rca.exists, true)
  assert.equal(rows.neIndex.absolute, join(root, 'regions/ID/IOH/00_索引/网元索引.md'))
  applyKbEnv(kb)
  assert.equal(JSON.parse(process.env.KB_PATHS).rca, rows.rca.absolute)
  resetKbContext()
  assert.equal(process.env.KB_PATHS, undefined)
}))

test('kb-context carries path anchors and inlines identity files (not README)', () => withKb((root) => {
  const { ctx, skills } = fakeCtx()
  registerKbContextSkill(ctx, resolveKbRoot(root))
  const body = skills.get('kb-context').content
  assert.ok(body.includes(join(root, 'regions/ID/IOH/00_索引/网元索引.md')))
  assert.ok(body.includes('不对外承诺恢复时间'))
  assert.equal(body.includes('template only'), false)
  assert.match(skills.get('kb-context').description, /IOH/)
}))

test('pack skills get the anchor footer; duplicate local name is skipped, not fatal', () => withKb(async (root) => {
  const { ctx, skills, warnings } = fakeCtx()
  const dispose = await registerKbPackSkills(ctx, resolveKbRoot(root), { enabled: true })
  assert.deepEqual([...skills.keys()].sort(), ['ioh-private', 'kb-retrieve', 'kb-troubleshoot'])
  assert.ok(skills.get('kb-troubleshoot').content.includes(join(root, 'regions/ID/IOH/00_有效RCA')))
  assert.ok(warnings.some(args => String(args[0]).includes('duplicates')))
  dispose()
  assert.equal(skills.size, 0)
}))

test('publishKbContext force re-notifies an unchanged snapshot', () => withKb((root) => {
  const kb = resolveKbRoot(root)
  publishKbContext(kb)
  let calls = 0
  const stop = watchKbContext(() => { calls += 1 })
  publishKbContext(kb)
  assert.equal(calls, 0)
  publishKbContext(kb, { force: true })
  assert.equal(calls, 1)
  stop()
  resetKbContext()
}))

test('kbSearch ranks multi-term hits first and honours scope', () => withKb((root) => {
  const kb = resolveKbRoot(root)
  const result = searchKb(kb, { query: 'mdn-bcp-cn bgp', scope: 'rca' })
  assert.ok(result.hits[0].relativePath.endsWith('20250911-MC-Aceh-Flap.md'))
  assert.deepEqual(result.hits[0].matchedTerms.sort(), ['bgp', 'mdn-bcp-cn'])
  assert.equal(result.hits[0].lines[0].line, 3)
  assert.equal(searchKb(kb, { query: 'isis', scope: 'neIndex' }).totalMatches, 0)
  assert.equal(searchKb(kb, { query: 'IS.S\\s+only', regex: true }).totalMatches, 1)
  assert.throws(() => searchKb(kb, { query: '(', regex: true }), /invalid regex/)
}))

test('kbRead pages files, lists dirs, and stays inside kbRoot', () => withKb((root) => {
  const kb = resolveKbRoot(root)
  const page = readKbFile(kb, { path: 'neIndex', offset: 2, limit: 1 })
  assert.equal(page.text, 'line2')
  assert.equal(page.truncated, true)
  const dir = readKbFile(kb, { path: 'rca' })
  assert.equal(dir.kind, 'directory')
  assert.deepEqual(dir.entries.map(e => e.name), ['02_路由'])
  assert.throws(() => readKbFile(kb, { path: `../${basename(root)}-secret.md` }), /escapes kbRoot/)
  assert.throws(() => readKbFile(kb, { path: `${root}-secret.md` }), /escapes kbRoot/)
}))

test('read tools mount without paths.local; write tools need it', () => withKb((root) => {
  const kb = resolveKbRoot(root)
  const readOnly = fakeCtx()
  registerKbLocalTools(readOnly.ctx, { ...kb, paths: { rca: kb.paths.rca } })
  assert.deepEqual([...readOnly.tools.keys()].sort(), ['netx__kbRead', 'netx__kbSearch'])
  const full = fakeCtx()
  registerKbLocalTools(full.ctx, kb)
  assert.equal(full.tools.size, 9)
}))
