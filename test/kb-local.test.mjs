/**
 * KB local path jail + create/update/delete ops.
 */

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  createDraft,
  createMemory,
  createRef,
  createSuggestion,
  deleteLocalFile,
  listLocalFiles,
  updateLocalFile,
} from '../src/netx/kb-local-ops.ts'
import {
  draftFileName,
  resolveKbLocalRoot,
  resolveWritableLocalPath,
  sanitizeSlug,
} from '../src/netx/kb-local-path.ts'
import { applyKbEnv, resetKbContext } from '../src/netx/kb-runtime.ts'

function snap(root, localRel = '_local') {
  return {
    status: 'configured',
    realRoot: root,
    operatorName: 'IOH',
    country: 'ID',
    version: '1',
    content: {
      hasRegions: true,
      hasTheory: false,
      hasPacket: false,
      hasCommon: false,
      hasSkills: false,
    },
    paths: { local: localRel },
    errorMessage: '',
  }
}

function withTemp(run) {
  const root = mkdtempSync(join(tmpdir(), 'netxops-kb-local-'))
  try {
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('sanitizeSlug strips separators', () => {
  assert.equal(sanitizeSlug('../evil/x'), 'evil-x')
  assert.equal(sanitizeSlug('你好 world'), '你好-world')
})

test('draftFileName forces DRAFT- prefix', () => {
  const name = draftFileName({ date: '2026-09-15', slug: 'jakarta-down' })
  assert.match(name, /^DRAFT-20260915-jakarta-down\.md$/)
})

test('resolveWritableLocalPath rejects non-writable roots', () => {
  withTemp((root) => {
    const local = join(root, '_local')
    mkdirSync(local, { recursive: true })
    assert.throws(
      () => resolveWritableLocalPath(local, 'local_skills', 'x.md'),
      /allowed under/,
    )
  })
})

test('create / update / delete memory', () => {
  withTemp((root) => {
    const s = snap(root)
    mkdirSync(join(root, '_local'), { recursive: true })
    const created = createMemory(s, {
      bucket: 'note',
      slug: 'smoke',
      body: '# hello\n',
      date: '2026-09-15',
    })
    assert.equal(created.action, 'created')
    assert.ok(created.relativePath.includes('日常笔记'))
    assert.equal(readFileSync(created.absolutePath, 'utf8'), '# hello\n')

    assert.throws(
      () => createMemory(s, {
        bucket: 'note',
        slug: 'smoke',
        body: 'x',
        date: '2026-09-15',
      }),
      /already exists/,
    )

    const updated = updateLocalFile(s, {
      path: created.relativePath,
      body: '# updated\n',
    })
    assert.equal(updated.action, 'updated')
    assert.equal(readFileSync(created.absolutePath, 'utf8'), '# updated\n')

    const listed = listLocalFiles(s, { root: 'memories' })
    assert.equal(listed.entries.length, 1)

    const deleted = deleteLocalFile(s, { path: created.absolutePath })
    assert.equal(deleted.action, 'deleted')
    assert.equal(listLocalFiles(s).entries.length, 0)
  })
})

test('draft injects status: draft frontmatter', () => {
  withTemp((root) => {
    const s = snap(root)
    mkdirSync(join(root, '_local'), { recursive: true })
    const created = createDraft(s, {
      slug: 'case-a',
      body: '# DRAFT\n\nbody\n',
      domain: '02_路由',
      date: '20260915',
    })
    const text = readFileSync(created.absolutePath, 'utf8')
    assert.match(text, /^---\nstatus: draft\n---/)
    assert.match(created.relativePath, /drafts\//)
  })
})

test('createRef device PROFILE + list refs', () => {
  withTemp((root) => {
    const s = snap(root)
    mkdirSync(join(root, '_local'), { recursive: true })
    assert.throws(
      () => createRef(s, { area: 'devices', slug: 'PROFILE', body: '# x\n' }),
      /requires device/,
    )
    const created = createRef(s, {
      area: 'devices',
      device: 'JKT-PE-01',
      slug: 'PROFILE',
      body: '# JKT-PE-01\n\nrole: PE\n',
    })
    assert.match(created.relativePath, /^refs\/devices\/JKT-PE-01\/PROFILE\.md$/)
    assert.equal(readFileSync(created.absolutePath, 'utf8'), '# JKT-PE-01\n\nrole: PE\n')

    createRef(s, {
      area: 'inventory',
      slug: 'ledger',
      body: '# ledger\n',
    })
    const listed = listLocalFiles(s, { root: 'refs' })
    assert.equal(listed.entries.length, 2)

    updateLocalFile(s, {
      path: created.relativePath,
      body: '# JKT-PE-01\n\nrole: PE\nupdated: true\n',
    })
    assert.match(readFileSync(created.absolutePath, 'utf8'), /updated: true/)
  })
})

test('suggestion create works', () => {
  withTemp((root) => {
    const s = snap(root)
    mkdirSync(join(root, '_local'), { recursive: true })
    const created = createSuggestion(s, {
      kind: 'improvement',
      slug: 'tool-x',
      body: '# sug\n',
      date: '2026-09-15',
    })
    assert.match(created.relativePath, /suggestions\/improvement\//)
  })
})

test('applyKbEnv sets KB_LOCAL', () => {
  withTemp((root) => {
    mkdirSync(join(root, '_local'), { recursive: true })
    const s = snap(root)
    assert.equal(resolveKbLocalRoot(s), join(root, '_local'))
    applyKbEnv(s)
    assert.equal(process.env.KB_LOCAL, join(root, '_local'))
    resetKbContext()
    assert.equal(process.env.KB_LOCAL, undefined)
  })
})
