/** Local UI QA using the real controller; no requests to Netx or the installed Host. */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const home = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
const anchors = ['desktop', 'web', ''].map(profile =>
  join(home, 'profiles', profile, 'node_modules', '@deepseek-ai', 'dsh-client-ui-renderer', 'package.json'))
let require
for (const anchor of anchors.filter(existsSync)) {
  const candidate = createRequire(anchor)
  try { candidate.resolve('react-dom/client'); require = candidate; break } catch { /* Try another Host. */ }
}
if (!require) throw new Error('UI preview requires the installed Harness React runtime.')
const result = await Bun.build({ entrypoints: [join(root, 'examples/local-debug/ui-preview.tsx')],
  target: 'browser', format: 'esm', define: { 'process.env.NODE_ENV': JSON.stringify('development') },
  plugins: [{ name: 'host-react', setup(build) {
    build.onResolve({ filter: /^(react(?:\/.*)?|react-dom\/client)$/ }, args => ({ path: require.resolve(args.path) }))
  } }],
})
if (!result.success) throw new Error(result.logs.map(String).join('\n'))
const bundle = await result.outputs[0].text()
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
  if (new URL(request.url).pathname === '/app.js') return new Response(bundle, { headers: { 'content-type': 'text/javascript' } })
  return new Response(`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Netx Ops · UI QA</title><style>body{margin:0;background:#f5f6f8;font-family:system-ui,sans-serif}main{max-width:820px;margin:24px auto;padding:0 20px}.preview-note{font-size:12px;color:#646a73;margin-bottom:16px}</style>
    <main><p class="preview-note">本地 UI 验证 · 模拟预设与状态，仅在内存中保存。Local UI preview; simulated Host data.</p><div id="root"></div></main><script type="module" src="/app.js"></script></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } })
} })
console.log(`Netx Ops UI preview: ${server.url}`)
