/**
 * Build lib/index.js (host Cordis plugin) for installs under node_modules.
 * Node refuses to strip TypeScript inside node_modules, so GitHub/npm installs
 * must ship prebuilt JS. Usage: bun run scripts/build-host.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const entry = join(root, 'src/index.ts')
const outFile = join(root, 'lib', 'index.js')

const external = [
  '@deepseek-ai/cordis',
  '@deepseek-ai/schemastery',
  '@deepseek-ai/dsh-credentials',
  '@deepseek-ai/dsh-settings',
  '@deepseek-ai/dsh-mcp-client',
  '@deepseek-ai/dsh-tools',
]

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
  throw new Error('Bun.build host failed')
}

const text = await result.outputs[0].text()
mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, text, 'utf8')
console.log(`wrote ${outFile} (${text.length} bytes)`)
