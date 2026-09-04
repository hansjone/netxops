/**
 * Build lib/client.js as a DSH ModuleLoader factory artifact using Bun's bundler.
 * Usage: bun run scripts/build-client.mjs
 *
 * Externals must match the *installed* web shell seed table. Shipped
 * `@deepseek-ai/dsh` 0.1.1-rc.2 seeds only:
 *   react, react/jsx-runtime, react-dom, react-dom/client,
 *   @deepseek-ai/cordis, dsh-client-ui-slots, dsh-client-ui-primitives
 * Do not leave other @deepseek-ai packages as require() targets unless they
 * are also listed in dsh.client.inject and arrive as graph factories.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const entry = join(root, 'src/client/index.ts')
const outFile = join(root, 'lib', 'client.js')
const id = 'dsh-netxops'

/** Exact PLATFORM_MODULES keys from shipped dsh-web-frontend seed. */
const external = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
]

const result = await Bun.build({
  entrypoints: [entry],
  target: 'browser',
  format: 'cjs',
  sourcemap: 'none',
  minify: false,
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  external,
})

if (!result.success) {
  console.error(result.logs)
  throw new Error('Bun.build failed')
}

const raw = await result.outputs[0].text()
if (raw.includes('react/jsx-dev-runtime')) {
  throw new Error('client bundle still references react/jsx-dev-runtime; refuse to ship')
}
if (raw.includes('@deepseek-ai/dsh-client-store')) {
  throw new Error('client bundle still requires dsh-client-store; refuse to ship')
}

const requires = [...raw.matchAll(/require\("([^"]+)"\)/g)].map(m => m[1])
const allowed = new Set(external)
for (const spec of requires) {
  if (!allowed.has(spec)) {
    throw new Error(`client bundle requires undeclared external "${spec}"; refuse to ship`)
  }
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
console.log(`wrote ${outFile} (${artifact.length} bytes); requires: ${[...new Set(requires)].join(', ') || '(none)'}`)
