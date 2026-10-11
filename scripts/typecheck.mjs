/** Check both plugin faces against the locally installed Harness declarations. */
import { createRequire } from 'node:module'
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const home = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
const anchors = [join(root, 'package.json'), ...['desktop', 'web', ''].map(profile =>
  join(home, 'profiles', profile, 'node_modules', '@deepseek-ai', 'dsh-client-ui-renderer', 'package.json'))]
const requires = anchors.filter(existsSync).flatMap(path => [createRequire(path), createRequire(realpathSync(path))])
function findPackage(name) {
  for (const req of requires) {
    try { return req.resolve(`${name}/package.json`) } catch { /* Try another installed profile. */ }
  }
  throw new Error(`Missing typecheck peer ${name}; install the Harness and run link:peers.`)
}
const paths = {}
for (const spec of [
  '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-locale/client',
  '@deepseek-ai/dsh-client-ui-renderer/client', '@deepseek-ai/dsh-api-remotes/client',
  '@deepseek-ai/dsh-client-ui-settings/client',
  '@deepseek-ai/dsh-client-ui-settings-plugins/client',
]) {
  const parts = spec.split('/'), pkgName = parts.slice(0, 2).join('/'), subpath = parts.slice(2).join('/')
  const pkgPath = findPackage(pkgName), pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const entry = pkg.exports?.[subpath ? `./${subpath}` : '.']
  const types = typeof entry === 'object' ? entry.types : pkg.types
  if (!types) throw new Error(`No declarations for ${spec}`)
  paths[spec] = [join(dirname(pkgPath), types)]
}
const nodeTypes = dirname(findPackage('@types/node'))
const folder = mkdtempSync(join(tmpdir(), 'netxops-typecheck-'))
try {
  const configPath = join(folder, 'tsconfig.json')
  writeFileSync(configPath, JSON.stringify({ compilerOptions: {
    target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx',
    noEmit: true, strict: true, skipLibCheck: true, allowImportingTsExtensions: true,
    types: ['node', 'react'], typeRoots: [dirname(nodeTypes), join(root, 'node_modules', '@types')], paths,
  }, include: [join(root, 'src', '**', '*.ts'), join(root, 'src', '**', '*.tsx')].map(path => path.replaceAll('\\', '/')) }))
  const result = spawnSync(process.execPath, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', configPath],
    { cwd: root, stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} finally {
  // The only cleanup target is the exact unique temporary directory returned above.
  const target = realpathSync(folder)
  const within = relative(realpathSync(tmpdir()), target)
  if (!within || within.startsWith('..') || isAbsolute(within) || !target.startsWith(resolve(folder))) {
    throw new Error(`Refusing cleanup outside the temporary workspace: ${target}`)
  }
  rmSync(target, { recursive: true, force: true })
}
