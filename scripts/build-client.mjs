/**
 * Build lib/client.js as a DSH ModuleLoader factory artifact using Bun's bundler.
 * Usage: bun run scripts/build-client.mjs
 *
 * Must emit production JSX (`react/jsx-runtime`). The web shell seeds only that
 * specifier — `react/jsx-dev-runtime` is not in PLATFORM_MODULES and fails load.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const entry = join(root, 'src/client/index.ts')
const outFile = join(root, 'lib', 'client.js')
const id = 'dsh-netxops'

/** Align with @deepseek-ai/dsh-client-web PLATFORM_MODULES + dsh.client.inject. */
const external = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-locale/client',
  '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-client-ui-settings/client',
  '@deepseek-ai/dsh-client-ui-settings-plugins',
  '@deepseek-ai/dsh-client-ui-settings-plugins/client',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-renderer',
  '@deepseek-ai/dsh-client-ui-renderer/client',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-api-remotes',
  '@deepseek-ai/dsh-api-remotes/client',
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-connection/client',
]

const result = await Bun.build({
  entrypoints: [entry],
  target: 'browser',
  format: 'cjs',
  sourcemap: 'none',
  minify: false,
  // Force production JSX transform (jsx-runtime, not jsx-dev-runtime).
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  external,
})

if (!result.success) {
  console.error(result.logs)
  throw new Error('Bun.build failed')
}

let raw = await result.outputs[0].text()
if (raw.includes('react/jsx-dev-runtime')) {
  throw new Error('client bundle still references react/jsx-dev-runtime; refuse to ship')
}

const body = raw
  .replace(/^"use strict";\s*/m, '')
  .replace(/Object\.defineProperty\(exports,\s*"__esModule"[\s\S]*?;\s*/m, '')

const artifact = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(id)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${body}
    return module.exports;
  }
});
`

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, artifact, 'utf8')
console.log(`wrote ${outFile} (${artifact.length} bytes)`)
