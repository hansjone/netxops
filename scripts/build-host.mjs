/**
 * Build lib/index.js (host) and lib/agent-tools.js (Ops preset tool mount).
 * Node refuses to strip TypeScript inside node_modules, so GitHub/npm installs
 * must ship prebuilt JS. Usage: bun run scripts/build-host.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'lib')

const external = [
  '@deepseek-ai/cordis',
  '@deepseek-ai/schemastery',
  '@deepseek-ai/dsh-credentials',
  '@deepseek-ai/dsh-settings',
  '@deepseek-ai/dsh-tools',
  '@deepseek-ai/dsh-llm',
  '@deepseek-ai/dsh-brand',
  '@deepseek-ai/dsh-agent',
  '@deepseek-ai/dsh-agent-presets',
  '@deepseek-ai/dsh-workspace',
  '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-session-title',
  '@deepseek-ai/dsh-permission-presets',
  '@deepseek-ai/dsh-agent-default-model',
]

const entries = [
  { entry: join(root, 'src/index.ts'), out: join(outDir, 'index.js') },
  { entry: join(root, 'src/agent-tools.ts'), out: join(outDir, 'agent-tools.js') },
  { entry: join(root, 'src/agent-tools-nms.ts'), out: join(outDir, 'agent-tools-nms.js') },
  { entry: join(root, 'src/agent-tools-common.ts'), out: join(outDir, 'agent-tools-common.js') },
  { entry: join(root, 'src/agent-tools-topology.ts'), out: join(outDir, 'agent-tools-topology.js') },
]

mkdirSync(outDir, { recursive: true })

for (const { entry, out } of entries) {
  const result = await Bun.build({
    entrypoints: [entry],
    target: 'node',
    format: 'esm',
    sourcemap: 'none',
    minify: false,
    external,
  })

  if (!result.success) {
    console.error(result.logs)
    throw new Error(`Bun.build host failed for ${basename(entry)}`)
  }

  const text = await result.outputs[0].text()
  writeFileSync(out, text, 'utf8')
  console.log(`wrote ${out} (${text.length} bytes)`)
}
