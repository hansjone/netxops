/**
 * Legacy entrypoint kept for `bun run gen:preset-patch`.
 *
 * Declarative `@deepseek-ai/dsh-agent-preset` patches were removed: Netx Ops
 * now composes `$DSH_HOME/.agent-presets/netxops` from the host `standard`
 * preset at apply time (see src/agent-preset-install.ts).
 *
 * Regenerates `cordis.bundle.patch.yml` as a copy of `cordis.patch.yml` so
 * `dsh.bundle.patch` stays a single string path for CLI compatibility.
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const host = join(root, 'cordis.patch.yml')
const bundle = join(root, 'cordis.bundle.patch.yml')
const legacyDeclarative = join(root, 'presets', 'netxops.preset.patch.yml')

const text = readFileSync(host, 'utf8')
const out = `# Alias of cordis.patch.yml for dsh.bundle.patch (single string).
# Agent preset is composed from host \`standard\` at install — see
# src/agent-preset-install.ts (no @deepseek-ai/dsh-agent-preset row).

${text.trimStart()}`
writeFileSync(bundle, out)
if (existsSync(legacyDeclarative)) {
  unlinkSync(legacyDeclarative)
  console.log(`removed obsolete ${legacyDeclarative}`)
}
console.log(`wrote ${bundle} (${out.length} bytes) — host-only; no declarative preset patch`)
