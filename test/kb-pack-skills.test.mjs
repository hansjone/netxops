/**
 * KB pack skill loader from realRoot/_skills (+ optional paths.localSkills).
 */

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  kbPackSkillsEnabled,
  registerKbPackSkills,
  resolveKbLocalSkillsRoot,
  resolveKbSkillsRoot,
} from '../src/netx/kb-pack-skills.ts'

async function withTemp(run) {
  const root = mkdtempSync(join(tmpdir(), 'netxops-kb-pack-'))
  try {
    await run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function configuredSnap(realRoot, content = {}, paths = {}) {
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
    paths: { ...paths },
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

test('resolveKbSkillsRoot uses paths.skills or defaults to _skills', () => {
  const snap = configuredSnap('/kb')
  assert.equal(resolveKbSkillsRoot(snap), join('/kb', '_skills'))
  assert.equal(
    resolveKbSkillsRoot(configuredSnap('/kb', {}, { skills: 'pack/skills' })),
    join('/kb', 'pack/skills'),
  )
})

test('resolveKbLocalSkillsRoot null when missing; joins when set', () => {
  assert.equal(resolveKbLocalSkillsRoot(configuredSnap('/kb')), null)
  assert.equal(
    resolveKbLocalSkillsRoot(configuredSnap('/kb', {}, {
      localSkills: 'regions/ID/IOH/_local/local_skills',
    })),
    join('/kb', 'regions/ID/IOH/_local/local_skills'),
  )
})

test('registerKbPackSkills also loads paths.localSkills/*/SKILL.md', async () => {
  await withTemp(async (root) => {
    const packDir = join(root, '_skills', 'kb-troubleshoot')
    mkdirSync(packDir, { recursive: true })
    writeFileSync(join(packDir, 'SKILL.md'), `---
name: kb-troubleshoot
description: KB triage playbook
---

# kb-troubleshoot
`, 'utf8')

    const localRel = join('regions', 'ID', 'IOH', '_local', 'local_skills')
    const localDir = join(root, localRel, 'ioh-local-rca')
    mkdirSync(localDir, { recursive: true })
    writeFileSync(join(localDir, 'SKILL.md'), `---
name: ioh-local-rca
description: IOH local RCA playbook
---

# ioh-local-rca
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

    await registerKbPackSkills(ctx, configuredSnap(root, {}, {
      skills: '_skills',
      localSkills: localRel.replace(/\\/g, '/'),
    }), { enabled: true })

    const names = registered.map((s) => s.name).sort()
    assert.deepEqual(names, ['ioh-local-rca', 'kb-troubleshoot'])
    assert.ok(registered.every((s) => s.provider === 'netxops-kb-pack'))
  })
})

test('registerKbPackSkills skips missing or empty localSkills', async () => {
  await withTemp(async (root) => {
    const skillDir = join(root, '_skills', 'kb-troubleshoot')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), `---
name: kb-troubleshoot
description: KB triage playbook
---

# kb-troubleshoot
`, 'utf8')

    const emptyLocal = join(root, '_local', 'local_skills')
    mkdirSync(emptyLocal, { recursive: true })

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

    await registerKbPackSkills(ctx, configuredSnap(root, {}, {
      localSkills: '_local/local_skills',
    }), { enabled: true })
    assert.equal(registered.length, 1)
    assert.equal(registered[0].name, 'kb-troubleshoot')

    registered.length = 0
    await registerKbPackSkills(ctx, configuredSnap(root, {}, {
      localSkills: '_local/does-not-exist',
    }), { enabled: true })
    assert.equal(registered.length, 1)
    assert.equal(registered[0].name, 'kb-troubleshoot')
  })
})
