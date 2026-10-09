import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  alignWorkflowEngineForHost,
  collectCompositionPackageNames,
  extractPluginsBodyFromStandardPatch,
  packageInstalledAbove,
  pluginsBodyToAgentCordis,
} from '../src/agent-preset-install.ts'

const SAMPLE_PATCH = `# comment
- insert:
    - id: preset-standard
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: standard
        order: 1
        plugins:
          - id: persona
            name: '@deepseek-ai/dsh-persona'
            config:
              prefix: hello
          - id: tool-skill
            name: '@deepseek-ai/dsh-tool-skill'
          - id: workflow-worker-thread
            name: '@deepseek-ai/dsh-workflow-worker-thread'
`

function seedPackage(root, name) {
  const dir = join(root, 'node_modules', ...name.split('/'))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version: '0.0.0' }))
}

describe('extractPluginsBodyFromStandardPatch', () => {
  it('keeps indented plugin rows and drops the insert wrapper', () => {
    const body = extractPluginsBodyFromStandardPatch(SAMPLE_PATCH)
    assert.match(body, /^          - id: persona$/m)
    assert.match(body, /workflow-worker-thread/)
    assert.doesNotMatch(body, /^- insert:/m)
    assert.doesNotMatch(body, /preset-standard/)
  })
})

describe('pluginsBodyToAgentCordis', () => {
  it('strips the declarative plugin indent', () => {
    const body = extractPluginsBodyFromStandardPatch(SAMPLE_PATCH)
    const cordis = pluginsBodyToAgentCordis(body)
    assert.match(cordis, /^- id: persona$/m)
    assert.match(cordis, /^  name: '@deepseek-ai\/dsh-persona'$/m)
    assert.doesNotMatch(cordis, /^          - id:/m)
  })
})

describe('alignWorkflowEngineForHost', () => {
  const worker = '- id: workflow-worker-thread\n  name: \'@deepseek-ai/dsh-workflow-worker-thread\'\n'

  it('rewrites worker-thread → ptc when only ptc is installed above bases', () => {
    const root = mkdtempSync(join(tmpdir(), 'netxops-preset-'))
    seedPackage(root, '@deepseek-ai/dsh-workflow-ptc')
    assert.equal(packageInstalledAbove('@deepseek-ai/dsh-workflow-ptc', [root]), true)
    assert.equal(packageInstalledAbove('@deepseek-ai/dsh-workflow-worker-thread', [root]), false)
    const out = alignWorkflowEngineForHost(worker, [root])
    assert.match(out, /- id: workflow-ptc/)
    assert.match(out, /dsh-workflow-ptc/)
    assert.doesNotMatch(out, /workflow-worker-thread/)
  })

  it('collectCompositionPackageNames reads quoted names', () => {
    const names = collectCompositionPackageNames(
      '- id: a\n  name: \'@deepseek-ai/dsh-workflow-ptc\'\n- id: b\n  name: "@deepseek-ai/dsh-tool-workflow"\n',
    )
    assert.deepEqual(
      names.sort(),
      ['@deepseek-ai/dsh-tool-workflow', '@deepseek-ai/dsh-workflow-ptc'].sort(),
    )
  })
})
