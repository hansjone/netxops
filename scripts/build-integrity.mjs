/** Track the actual bundle inputs so a release cannot silently ship stale JS. */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = resolve(root, '.release-build.json')
export const hashText = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex')
export const hashFile = path => hashText(readFileSync(path, 'utf8'))

export function recordBuild(output, result, buildScript) {
  if (!result.metafile) throw new Error('Build metadata is missing; use Bun >=1.3.13.')
  const inputs = [...new Set([
    'package.json', 'pnpm-lock.yaml', buildScript, 'scripts/build-integrity.mjs',
    ...Object.keys(result.metafile.inputs).map(path => relative(root, resolve(path)).replaceAll('\\', '/'))
      .filter(path => path.startsWith('src/')),
  ])].sort()
  if (!inputs.some(path => path.startsWith('src/'))) throw new Error('Bundle has no recorded source inputs.')
  for (const path of inputs) {
    if (isAbsolute(path) || path.startsWith('../')) throw new Error(`Build input escapes repository: ${path}`)
  }
  let builds = {}
  try { builds = JSON.parse(readFileSync(manifestPath, 'utf8')).builds ?? {} } catch { /* First build. */ }
  const key = relative(root, output).replaceAll('\\', '/')
  builds[key] = { output: hashFile(output), inputs: Object.fromEntries(inputs.map(path => [path, hashFile(resolve(root, path))])) }
  writeFileSync(manifestPath, `${JSON.stringify({ format: 1, builds: Object.fromEntries(Object.entries(builds).sort()) }, null, 2)}\n`)
}

export function checkBuilds(directory = root) {
  const manifest = JSON.parse(readFileSync(resolve(directory, '.release-build.json'), 'utf8'))
  if (manifest.format !== 1) throw new Error('Unknown build manifest format.')
  const pkg = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'))
  const outputs = [...new Set(Object.values(pkg.exports).filter(path => path.endsWith('.js')).map(path => path.replace(/^\.\//, '')))]
  for (const output of outputs) {
    const build = manifest.builds?.[output]
    if (!build || hashFile(resolve(directory, output)) !== build.output) throw new Error(`Missing or modified artifact: ${output}; run bun run bundle.`)
    for (const [path, hash] of Object.entries(build.inputs)) {
      if (isAbsolute(path) || path.startsWith('../')) throw new Error(`Invalid build input: ${path}`)
      if (hashFile(resolve(directory, path)) !== hash) throw new Error(`Stale artifact ${output}: ${path} changed; run bun run bundle.`)
    }
  }
  return outputs
}
