/** Publisher check. No install lifecycle invokes this on a user's machine. */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { isBuiltin } from 'node:module'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { load } from 'js-yaml'
import ts from 'typescript'
import { checkBuilds, root } from './build-integrity.mjs'

export function verifyRelease(directory = root) {
  const read = path => readFileSync(resolve(directory, path), 'utf8')
  const pkg = JSON.parse(read('package.json'))
  const outputs = checkBuilds(directory)
  assert.equal(pkg.name, 'dsh-netxops')
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/)
  assert.equal(pkg.type, 'module')
  for (const script of ['preinstall', 'install', 'postinstall', 'prepare', 'prepack', 'postpack', 'prepublish']) {
    assert.ok(!pkg.scripts?.[script], `User installs must not run ${script}.`)
  }
  assert.deepEqual(pkg.dependencies, {}, 'Runtime third-party dependencies must be bundled.')
  for (const [name, range] of Object.entries(pkg.peerDependencies)) {
    assert.equal(pkg.peerDependenciesMeta[name]?.optional, true, `${name} must be supplied by Harness.`)
    assert.doesNotMatch(range, /workspace:|file:|link:|github:/)
  }
  for (const path of Object.values(pkg.exports)) {
    assert.ok(path.startsWith('./') && !path.includes('..'), `Unsafe export: ${path}`)
    if (!path.includes('*')) assert.ok(existsSync(resolve(directory, path)), `Missing export: ${path}`)
  }
  assert.ok(read(pkg.icon).includes('<svg'), 'Missing plugin icon.')
  for (const lang of ['en', 'zh']) {
    const locale = JSON.parse(read(`locale/${lang}.json`))
    assert.ok(locale.meta.title && locale.meta.description, `Missing ${lang} plugin metadata.`)
  }
  assert.equal(pkg.dsh.client.immediately, false)
  const patch = load(read(pkg.dsh.bundle.patch))
  assert.ok(Array.isArray(patch) && patch.length > 0)
  const hosts = patch.flatMap(row => row.insert ?? []).filter(row => row.name === pkg.name)
  assert.equal(hosts.length, 1, 'Bundle must insert exactly one Host bridge.')
  assert.equal(hosts[0].id, 'netxops')
  const declared = new Set(Object.keys(pkg.peerDependencies))
  for (const output of outputs) {
    const text = read(output)
    const parsed = spawnSync(process.execPath, ['--check', resolve(directory, output)], { encoding: 'utf8', windowsHide: true })
    assert.equal(parsed.status, 0, `Invalid JS in ${output}: ${parsed.stderr}`)
    assert.doesNotMatch(text, /\bBun\.|react\/jsx-dev-runtime|agent-tools-shared|(?:from|import\()\s*["']\.\//)
    if (output !== 'lib/client.js') {
      const source = ts.createSourceFile(output, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
      const visit = node => {
        const specifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
          ? node.moduleSpecifier
          : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : undefined
        if (specifier && ts.isStringLiteral(specifier)) {
          assert.ok(isBuiltin(specifier.text) || declared.has(specifier.text), `${output} needs undeclared dependency ${specifier.text}`)
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
  }
  let client
  vm.runInNewContext(read('lib/client.js'), { window: { __ModuleLoader__: { load(value) { client = value } } } })
  assert.equal(client.id, pkg.name)
  assert.equal(typeof client.factory, 'function')
  const clientExports = client.factory(name => {
    assert.ok(['react', 'react/jsx-runtime'].includes(name), `Unseeded browser dependency: ${name}`)
    return {}
  })
  assert.equal(typeof clientExports.apply, 'function')
  assert.deepEqual(Array.from(clientExports.inject), ['slots', 'locale'])
  for (const path of ['presets/netxops/PERSONA.md', 'presets/netxops/preset.yml']) assert.ok(read(path).trim())
  assert.equal(existsSync(resolve(directory, 'presets/netxops/skills')), false, 'Group skills must not be bundled')
  return { version: pkg.version, outputs }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const result = verifyRelease()
    console.log(`Release ${result.version}: ${result.outputs.length} JS artifacts and bundle verified.`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
