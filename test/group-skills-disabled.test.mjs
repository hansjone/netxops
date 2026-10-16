/**
 * Skill injection appends disabled-tool footnotes when tools are filtered.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { registerGroupSkills } from '../src/netx/group-skills.ts'
import { replaceSkillsCache } from '../src/netx/skills-cache.ts'

const OPS_SKILL = `---
name: netx-ops
description: Ops playbook
---
Body
`

test('registerGroupSkills appends disabled footnote; skips disabled groups', async (t) => {
  const previous = process.env.DSH_HOME
  const home = mkdtempSync(join(tmpdir(), 'netxops-skills-disabled-'))
  process.env.DSH_HOME = home
  t.after(() => {
    rmSync(home, { recursive: true, force: true })
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  })

  const apiUrl = 'http://127.0.0.1:8890'
  const root = replaceSkillsCache(apiUrl, [{
    group: 'ops',
    skill: 'netx-ops',
    relPath: 'SKILL.md',
    text: OPS_SKILL,
  }])

  /** @type {Array<{ name: string, content: string }>} */
  const registered = []
  const ctx = {
    skills: {
      register(skill) {
        registered.push({ name: skill.name, content: skill.content })
        return () => {}
      },
    },
    logger: { warn() {} },
  }

  const dispose = await registerGroupSkills(ctx, ['ops'], 'test', {
    skillsRoot: root,
    disabledByGroup: { ops: ['netx__execManagedNe'] },
    lang: 'zh',
  })
  assert.ok(registered.length >= 1)
  assert.match(registered[0].content, /以下工具已禁用：netx__execManagedNe，不要调用/)
  dispose()

  registered.length = 0
  const dispose2 = await registerGroupSkills(ctx, [], 'test', {
    skillsRoot: root,
    disabledByGroup: { ops: ['netx__execManagedNe'] },
  })
  assert.equal(registered.length, 0)
  dispose2()

  registered.length = 0
  const dispose3 = await registerGroupSkills(ctx, ['ops'], 'test', {
    skillsRoot: root,
    disabledByGroup: { ops: ['netx__execManagedNe'] },
    lang: 'en',
  })
  assert.match(registered[0].content, /The following tools are disabled: netx__execManagedNe/)
  dispose3()
})
