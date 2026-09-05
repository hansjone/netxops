/**
 * Group skill loader: one capability group ↔ one skill dir.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import { opsSkillsRoot } from '../src/netx/group-skills.ts'
import { SKILL_DIR_BY_GROUP } from '../src/netx/capability-groups.ts'

test('opsSkillsRoot points at ops / topology playbook dirs', () => {
  const root = opsSkillsRoot()
  assert.ok(existsSync(root), root)
  for (const dir of Object.values(SKILL_DIR_BY_GROUP)) {
    assert.ok(existsSync(join(root, dir)), join(root, dir))
  }
})

test('each group dir has a playbook with name + description', () => {
  const root = opsSkillsRoot()
  for (const group of Object.keys(SKILL_DIR_BY_GROUP)) {
    const groupDir = join(root, SKILL_DIR_BY_GROUP[group])
    const bundles = readdirSync(groupDir).filter((name) => existsSync(join(groupDir, name, 'SKILL.md')))
    assert.ok(bundles.length >= 1, group)
    const raw = readFileSync(join(groupDir, bundles[0], 'SKILL.md'), 'utf8')
    assert.match(raw, /^---\r?\n/)
    assert.match(raw, /\nname:\s+\S+/)
    assert.match(raw, /\ndescription:\s/)
  }
})
