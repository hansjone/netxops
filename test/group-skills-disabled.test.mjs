/**
 * Skill injection appends disabled-tool footnotes when tools are filtered.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { registerGroupSkills } from '../src/netx/group-skills.ts'

test('registerGroupSkills appends disabled footnote; skips disabled groups', async () => {
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
    disabledByGroup: { ops: ['netx__execManagedNe'] },
    lang: 'zh',
  })
  assert.ok(registered.length >= 1)
  assert.match(registered[0].content, /以下工具已禁用：netx__execManagedNe，不要调用/)
  dispose()

  registered.length = 0
  const dispose2 = await registerGroupSkills(ctx, [], 'test', {
    disabledByGroup: { ops: ['netx__execManagedNe'] },
  })
  assert.equal(registered.length, 0)
  dispose2()

  registered.length = 0
  const dispose3 = await registerGroupSkills(ctx, ['ops'], 'test', {
    disabledByGroup: { ops: ['netx__execManagedNe'] },
    lang: 'en',
  })
  assert.match(registered[0].content, /The following tools are disabled: netx__execManagedNe/)
  dispose3()
})
