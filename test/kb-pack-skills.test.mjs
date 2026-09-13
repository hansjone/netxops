/**
 * KB pack skill loader from realRoot/_skills.
 */

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { kbPackSkillsEnabled, registerKbPackSkills } from '../src/netx/kb-pack-skills.ts'

async function withTemp(run) {
  const root = mkdtempSync(join(tmpdir(), 'netxops-kb-pack-'))
  try {
    await run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function configuredSnap(realRoot, content = {}) {
  return {
    status: 'configured',
    realRoot,
    operatorName: 'IOH',
    country: 'ID',
    version: '1',
    content: {
      hasRegions: false,
      hasTheory: false,
      hasPacket: false,
      hasCommon: false,
      hasSkills: true,
      ...content,
    },
    errorMessage: '',
  }
}

test('kbPackSkillsEnabled requires configured + hasSkills', () => {
  assert.equal(kbPackSkillsEnabled(configuredSnap('/x')), true)
  assert.equal(kbPackSkillsEnabled(configuredSnap('/x', { hasSkills: false })), false)
  assert.equal(kbPackSkillsEnabled({
    ...configuredSnap('/x'),
    status: 'unconfigured',
  }), false)
})

test('registerKbPackSkills loads _skills/*/SKILL.md', async () => {
  await withTemp(async (root) => {
    const skillDir = join(root, '_skills', 'kb-troubleshoot')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), `---
name: kb-troubleshoot
description: KB triage playbook
---

# kb-troubleshoot
`, 'utf8')

    const registered = []
    const ctx = {
      logger: { info() {}, warn() {} },
      skills: {
        register(skill) {
          registered.push(skill)
          return () => {}
        },
      },
    }

    const dispose = await registerKbPackSkills(ctx, configuredSnap(root), { enabled: true })
    assert.equal(registered.length, 1)
    assert.equal(registered[0].name, 'kb-troubleshoot')
    assert.equal(registered[0].provider, 'netxops-kb-pack')
    dispose()
  })
})

test('registerKbPackSkills no-op when disabled or hasSkills false', async () => {
  const registered = []
  const ctx = {
    logger: { info() {}, warn() {} },
    skills: {
      register(skill) {
        registered.push(skill)
        return () => {}
      },
    },
  }
  await registerKbPackSkills(ctx, configuredSnap('/nope'), { enabled: false })
  await registerKbPackSkills(ctx, configuredSnap('/nope', { hasSkills: false }), { enabled: true })
  assert.equal(registered.length, 0)
})
