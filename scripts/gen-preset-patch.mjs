/**
 * Regenerate `presets/netxops.preset.patch.yml` from
 * `presets/netxops/{preset.yml,agent.cordis.yml}` so the declarative
 * `@deepseek-ai/dsh-agent-preset` row stays in sync with the directory
 * composition used on DSH ≤0.1.5.
 *
 * Also writes `cordis.bundle.patch.yml` = host cordis + preset patch.
 * DSH CLI `dsh.bundle.patch` is a single string path (not string[]); keep
 * sources split for editing but ship one concatenated entry for boot.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const cordis = readFileSync(join(root, 'presets/netxops/agent.cordis.yml'), 'utf8')
const metaText = readFileSync(join(root, 'presets/netxops/preset.yml'), 'utf8')

const name = (metaText.match(/^name:\s*(.+)$/m) || [])[1]?.trim() || 'Netx Ops'
const description = (metaText.match(/^description:\s*(.+)$/m) || [])[1]?.trim() || ''
const order = (metaText.match(/^order:\s*(\d+)/m) || [])[1] || '50'

const pluginsBody = cordis
  .split(/\r?\n/)
  .map((line) => `        ${line}`)
  .join('\n')

const out = `# Declarative Netx Ops agent preset for DSH ≥0.2.0-rc.1.
# Directory copy under ~/.dsh/.agent-presets is ignored on these hosts —
# keep presets/netxops/agent.cordis.yml in sync with config.plugins below
# (regenerate: bun run scripts/gen-preset-patch.mjs).

- insert:
    - id: preset-netxops
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: netxops
        order: ${order}
        name: ${JSON.stringify(name)}
        description: ${JSON.stringify(description)}
        plugins:
${pluginsBody}
`

const dest = join(root, 'presets/netxops.preset.patch.yml')
writeFileSync(dest, out)
console.log(`wrote ${dest} (${out.length} bytes)`)

const hostPatch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8').trimEnd()
const bundle = `# Combined host + declarative preset for dsh.bundle.patch (single string).
# Sources: cordis.patch.yml + presets/netxops.preset.patch.yml
# Regenerate: bun run scripts/gen-preset-patch.mjs

${hostPatch}

${out.trimStart()}`
const bundleDest = join(root, 'cordis.bundle.patch.yml')
writeFileSync(bundleDest, bundle)
console.log(`wrote ${bundleDest} (${bundle.length} bytes)`)
