/**
 * Regenerate declarative + bundle artifacts from host `standard`.
 *
 * - `presets/netxops.preset.patch.yml` — Desktop 0.2 `@deepseek-ai/dsh-agent-preset`
 *   insert (also synced into profiles/desktop/cordis.patch.yml at Host apply).
 * - `cordis.bundle.patch.yml` — host-only (web-safe). Desktop gets the
 *   declarative row via the profile patch sync, not the package bundle, so
 *   `dsh web` does not require `@deepseek-ai/dsh-agent-preset`.
 *
 * Usage: bun run scripts/gen-preset-patch.mjs
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { composeNetxopsPresetArtifacts } from '../src/agent-preset-install.ts'
import { readFileSync } from 'node:fs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const artifacts = composeNetxopsPresetArtifacts()
const declarativePath = join(root, 'presets', 'netxops.preset.patch.yml')
writeFileSync(declarativePath, artifacts.declarativePatch)
console.log(
  `wrote ${declarativePath} (${artifacts.declarativePatch.length} bytes) `
  + `from ${artifacts.standardKind}: ${artifacts.standardSource}`,
)

const host = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
const bundle = `# Host-only bundle patch (web-safe).
# Desktop Netx Ops preset is composed from standard and synced into
# profiles/desktop/cordis.patch.yml at Host apply — see src/agent-preset-install.ts.

${host.trimStart()}`
const bundlePath = join(root, 'cordis.bundle.patch.yml')
writeFileSync(bundlePath, bundle)
console.log(`wrote ${bundlePath} (${bundle.length} bytes) — host only`)
