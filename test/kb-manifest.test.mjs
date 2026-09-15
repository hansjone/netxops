/**
 * MANIFEST locate + validate for operator-subset knowledge packages.
 */

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  findManifest,
  parseManifest,
  parsePaths,
  resolveKbRoot,
} from '../src/netx/kb-manifest.ts'

function validManifest(overrides = {}) {
  return JSON.stringify({
    schemaVersion: '1.0',
    packageType: 'operator-subset',
    operator: { name: 'IOH', country: 'ID' },
    version: '2026.09.01',
    content: { hasRegions: true, hasTheory: false, hasPacket: true },
    ...overrides,
  }, null, 2)
}

function withTemp(run) {
  const root = mkdtempSync(join(tmpdir(), 'netxops-kb-'))
  try {
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('empty kbRoot → unconfigured', () => {
  const snap = resolveKbRoot('')
  assert.equal(snap.status, 'unconfigured')
  assert.equal(snap.realRoot, '')
  assert.equal(snap.errorMessage, '')
})

test('direct MANIFEST at kbRoot', () => {
  withTemp((root) => {
    writeFileSync(join(root, 'MANIFEST.json'), validManifest(), 'utf8')
    const snap = resolveKbRoot(root)
    assert.equal(snap.status, 'configured')
    assert.equal(snap.realRoot, root)
    assert.equal(snap.operatorName, 'IOH')
    assert.equal(snap.country, 'ID')
    assert.equal(snap.version, '2026.09.01')
    assert.equal(snap.content.hasRegions, true)
    assert.equal(snap.content.hasTheory, false)
    assert.equal(snap.content.hasPacket, true)
    assert.equal(snap.content.hasSkills, false)
    assert.equal(snap.content.hasCommon, false)
    assert.equal('regions' in snap.content, false)
  })
})

test('nested one level under maxDepth', () => {
  withTemp((root) => {
    const pkg = join(root, 'packages', 'ioh')
    mkdirSync(pkg, { recursive: true })
    writeFileSync(join(pkg, 'MANIFEST.json'), validManifest({
      operator: { name: 'XL', country: 'ID' },
      version: '1.2.3',
    }), 'utf8')
    const snap = resolveKbRoot(root)
    assert.equal(snap.status, 'configured')
    assert.equal(snap.realRoot, pkg)
    assert.equal(snap.operatorName, 'XL')
    assert.equal(snap.version, '1.2.3')
  })
})

test('zero manifests → error', () => {
  withTemp((root) => {
    mkdirSync(join(root, 'empty'), { recursive: true })
    const snap = resolveKbRoot(root)
    assert.equal(snap.status, 'error')
    assert.match(snap.errorMessage, /no MANIFEST\.json/)
  })
})

test('multiple nested manifests → error', () => {
  withTemp((root) => {
    const a = join(root, 'a')
    const b = join(root, 'b')
    mkdirSync(a, { recursive: true })
    mkdirSync(b, { recursive: true })
    writeFileSync(join(a, 'MANIFEST.json'), validManifest(), 'utf8')
    writeFileSync(join(b, 'MANIFEST.json'), validManifest({
      operator: { name: 'Other', country: 'XX' },
    }), 'utf8')
    const snap = resolveKbRoot(root)
    assert.equal(snap.status, 'error')
    assert.match(snap.errorMessage, /ambiguous/)
  })
})

test('bad JSON → error', () => {
  withTemp((root) => {
    writeFileSync(join(root, 'MANIFEST.json'), '{not-json', 'utf8')
    const snap = resolveKbRoot(root)
    assert.equal(snap.status, 'error')
    assert.match(snap.errorMessage, /not valid JSON/)
  })
})

test('wrong schemaVersion / packageType rejected', () => {
  assert.throws(
    () => parseManifest(validManifest({ schemaVersion: '2.0' })),
    /schemaVersion/,
  )
  assert.throws(
    () => parseManifest(validManifest({ packageType: 'full-tree' })),
    /packageType/,
  )
})

test('legacy short content keys map to has*; no dual truth', () => {
  const parsed = parseManifest(validManifest({ content: { regions: true, packet: true } }))
  assert.equal(parsed.content.hasRegions, true)
  assert.equal(parsed.content.hasPacket, true)
  assert.equal(parsed.content.hasTheory, false)
  assert.equal('regions' in parsed.content, false)
  assert.equal('packet' in parsed.content, false)
})

test('contract has* wins over legacy short key', () => {
  const parsed = parseManifest(validManifest({
    content: { hasRegions: false, regions: true },
  }))
  assert.equal(parsed.content.hasRegions, false)
  assert.equal('regions' in parsed.content, false)
})

test('content missing keys default false; missing content object fails', () => {
  const parsed = parseManifest(validManifest({ content: { hasRegions: true } }))
  assert.equal(parsed.content.hasRegions, true)
  assert.equal(parsed.content.hasTheory, false)
  assert.equal(parsed.content.hasPacket, false)
  const withoutContent = JSON.stringify({
    schemaVersion: '1.0',
    packageType: 'operator-subset',
    operator: { name: 'IOH', country: 'ID' },
    version: '1',
  })
  assert.throws(() => parseManifest(withoutContent), /content/)
})

test('findManifest respects maxDepth', () => {
  withTemp((root) => {
    const deep = join(root, 'a', 'b', 'c', 'd')
    mkdirSync(deep, { recursive: true })
    writeFileSync(join(deep, 'MANIFEST.json'), validManifest(), 'utf8')
    const tooDeep = findManifest(root, 3)
    assert.equal(tooDeep.paths.length, 0)
    const ok = findManifest(root, 4)
    assert.equal(ok.paths.length, 1)
  })
})

test('path to MANIFEST.json file resolves via parent dir', () => {
  withTemp((root) => {
    const manifestPath = join(root, 'MANIFEST.json')
    writeFileSync(manifestPath, validManifest(), 'utf8')
    const snap = resolveKbRoot(manifestPath)
    assert.equal(snap.status, 'configured')
    assert.equal(snap.realRoot, root)
    assert.equal(snap.operatorName, 'IOH')
  })
})

test('contract content flags hasRegions etc. are accepted', () => {
  withTemp((root) => {
    writeFileSync(join(root, 'MANIFEST.json'), validManifest({
      content: {
        hasRegions: true,
        hasTheory: true,
        hasPacket: true,
        hasCommon: true,
        hasSkills: true,
      },
    }), 'utf8')
    const snap = resolveKbRoot(root)
    assert.equal(snap.status, 'configured')
    assert.equal(snap.content.hasRegions, true)
    assert.equal(snap.content.hasSkills, true)
    assert.equal(snap.content.hasCommon, true)
    assert.deepEqual(snap.paths, {})
  })
})

test('paths.skills / paths.localSkills parsed; blank skipped', () => {
  const parsed = parseManifest(validManifest({
    paths: {
      skills: '_skills',
      localSkills: 'regions/印尼-Indonesia/IOH/_local/local_skills',
      rca: 'regions/印尼-Indonesia/IOH/00_有效RCA',
      empty: '  ',
      bad: 12,
    },
  }))
  assert.equal(parsed.paths.skills, '_skills')
  assert.equal(parsed.paths.localSkills, 'regions/印尼-Indonesia/IOH/_local/local_skills')
  assert.equal(parsed.paths.rca, 'regions/印尼-Indonesia/IOH/00_有效RCA')
  assert.equal(parsed.paths.empty, undefined)
  assert.equal(parsed.paths.bad, undefined)
})

test('paths missing → empty object; invalid type rejected', () => {
  assert.deepEqual(parsePaths(undefined), {})
  assert.deepEqual(parsePaths(null), {})
  assert.throws(() => parsePaths([]), /paths must be an object/)
  withTemp((root) => {
    writeFileSync(join(root, 'MANIFEST.json'), validManifest({
      paths: {
        skills: '_skills',
        localSkills: 'regions/ID/IOH/_local/local_skills',
      },
    }), 'utf8')
    const snap = resolveKbRoot(root)
    assert.equal(snap.status, 'configured')
    assert.equal(snap.paths.skills, '_skills')
    assert.equal(snap.paths.localSkills, 'regions/ID/IOH/_local/local_skills')
  })
})
