import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { root } from './build-integrity.mjs'
import { npmRuntime } from './npm-cli.mjs'
import { verifyRelease } from './verify-release.mjs'

const verified = verifyRelease()
const { node, npm } = npmRuntime()
const packed = spawnSync(node, [npm, 'pack', '--json', '--ignore-scripts', '--cache', join(tmpdir(), 'netxops-npm-cache')], {
  cwd: root, encoding: 'utf8', windowsHide: true,
})
if (packed.status !== 0) throw new Error(packed.stderr || String(packed.error))
const info = JSON.parse(packed.stdout)[0]
const file = join(root, info.filename)
const sha = createHash('sha256').update(readFileSync(file)).digest('hex')
writeFileSync(`${file}.sha256`, `${sha}  ${info.filename}\n`)
console.log(`Release ${verified.version}: ${info.files.length} files, ${(info.size / 1024).toFixed(1)} KiB`)
console.log(`Package: ${file}\nSHA256: ${sha}`)
