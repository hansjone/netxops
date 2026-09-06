import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  safePathSegment,
  sessionsExportEntries,
  sessionsExportZipFilename,
} from '../src/netx/session-export.ts'

test('safePathSegment strips path separators and keeps filename extensions', () => {
  assert.equal(safePathSegment('../a/b'), 'b')
  assert.equal(safePathSegment('..\\evil.jsonl'), 'evil.jsonl')
  assert.equal(safePathSegment('session.jsonl'), 'session.jsonl')
  assert.equal(safePathSegment('netxops-alarm-abc'), 'netxops-alarm-abc')
})

test('sessionsExportZipFilename stamps host and UTC time', () => {
  const name = sessionsExportZipFilename(new Date('2026-09-06T04:59:00.000Z'), 'edge-01')
  assert.equal(name, 'dsh-sessions-edge-01-20260906-045900.zip')
})

test('sessionsExportEntries writes manifest then artifacts; skips missing', async () => {
  const persistence = {
    supportsRawArtifacts: true,
    list: async () => ([
      { id: 's1', version: 0, createdAt: 1, agentPreset: 'netxops' },
      { id: 'missing', version: 0, createdAt: 2 },
    ]),
    readRaw: async (id) => {
      if (id === 'missing') return undefined
      return {
        meta: { id, version: 0, createdAt: 1, agentPreset: 'netxops' },
        filename: 'session.jsonl',
        content: '{"type":"header"}\n',
      }
    },
  }
  const ctx = {
    get: (name) => (name === 'sessionPersistence' ? persistence : undefined),
  }
  const entries = []
  for await (const entry of sessionsExportEntries(ctx, undefined)) {
    entries.push(entry)
  }
  assert.equal(entries.length, 2)
  assert.equal(entries[0].path, 'manifest.json')
  const manifest = JSON.parse(entries[0].content)
  assert.equal(manifest.kind, 'dsh-netxops-sessions-export')
  assert.equal(manifest.sessionCountListed, 2)
  assert.equal(manifest.sessionCountIncluded, 1)
  assert.equal(manifest.sessionCountSkipped, 1)
  assert.equal(entries[1].path, 'sessions/s1/session.jsonl')
  assert.match(entries[1].content, /header/)
})

test('writeSessionsExportZip lands under exports/ with a real zip', async () => {
  const { mkdtempSync, readFileSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { unzipSync, strFromU8 } = await import('fflate')
  const home = mkdtempSync(join(tmpdir(), 'netxops-export-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = home
  try {
    const persistence = {
      supportsRawArtifacts: true,
      list: async () => ([{ id: 's1', version: 0, createdAt: 1 }]),
      readRaw: async () => ({
        meta: { id: 's1', version: 0, createdAt: 1 },
        filename: 'session.jsonl',
        content: '{"type":"header"}\n',
      }),
    }
    const ctx = {
      get: (name) => (name === 'sessionPersistence' ? persistence : undefined),
    }
    const { writeSessionsExportZip } = await import('../src/netx/session-export.ts')
    const result = await writeSessionsExportZip(ctx)
    assert.equal(result.sessionCountIncluded, 1)
    assert.ok(result.path.includes(`${join('exports')}`))
    assert.ok(result.bytes > 0)
    const unzipped = unzipSync(readFileSync(result.path))
    assert.ok(unzipped['manifest.json'])
    assert.match(strFromU8(unzipped['sessions/s1/session.jsonl']), /header/)
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    rmSync(home, { recursive: true, force: true })
  }
})
