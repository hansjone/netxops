/**
 * Desktop / pnpm `link:` installs resolve `@deepseek-ai/*` from this package's
 * real path (the workspace), not from the profile `node_modules`. GitHub/file
 * installs work because the package is copied under the profile.
 *
 * Junction Host peer packages from the DSH installation into
 * `./node_modules/@deepseek-ai/*` so linked local installs can boot.
 *
 * Usage:
 *   bun run link:peers
 *   node scripts/link-dsh-peers.mjs --profile desktop
 *   .\scripts\link-dsh-peers.ps1
 */

import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dshHome = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')

/** Runtime imports from src/index.ts (+ commonly needed neighbors). */
const peers = [
  'schemastery',
  'cordis',
  'dsh-credentials',
  'dsh-settings',
  'dsh-tools',
  'dsh-llm',
]

function profileArg() {
  const idx = process.argv.indexOf('--profile')
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]
  return 'desktop'
}

/**
 * Prefer the shared healed fallback `profiles/node_modules` (one coherent peer
 * set: schemastery 3.18.2 + dsh-* 0.1.5-rc.2). Do NOT prefer the Desktop
 * profile's schemastery first — Desktop 0.2 ships 3.18.4 which, when linked
 * alone into this package, makes `Config({})` return cosmokit volatile proxies
 * instead of defaults and Host apply fails ("web boot: dsh-netxops failed").
 * Do NOT createRequire() — that can walk into an unrelated checkout via NODE_PATH.
 */
function candidateDirs(profile) {
  return [
    join(dshHome, 'profiles', 'node_modules', '@deepseek-ai'),
    join(dshHome, 'profiles', profile, 'node_modules', '@deepseek-ai'),
    join(dshHome, 'profiles', 'web', 'node_modules', '@deepseek-ai'),
  ]
}

function resolvePeer(shortName, dirs) {
  for (const dir of dirs) {
    const target = join(dir, shortName)
    if (existsSync(join(target, 'package.json'))) return target
  }
  return null
}

function linkOne(shortName, target) {
  const dest = join(root, 'node_modules', '@deepseek-ai', shortName)
  mkdirSync(dirname(dest), { recursive: true })
  if (existsSync(dest)) {
    const st = lstatSync(dest)
    if (st.isSymbolicLink() || st.isDirectory()) {
      rmSync(dest, { recursive: true, force: true })
    } else {
      throw new Error(`refusing to replace non-link path ${dest}`)
    }
  }
  symlinkSync(target, dest, 'junction')
  const ver = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')).version
  console.log(`linked @deepseek-ai/${shortName}@${ver} <- ${target}`)
}

const profile = profileArg()
const dirs = candidateDirs(profile)
console.log(`DSH_HOME=${dshHome} profile=${profile}`)
console.log(`search:\n  ${dirs.join('\n  ')}`)

let missing = 0
for (const name of peers) {
  const target = resolvePeer(name, dirs)
  if (!target) {
    console.error(`missing peer @deepseek-ai/${name}`)
    missing++
    continue
  }
  linkOne(name, target)
}

if (missing > 0) {
  console.error(`\n${missing} peer(s) missing — run Desktop/web once so profiles/node_modules is healed.`)
  process.exit(1)
}

console.log('\nDone. Restart DeepSeek Harness Desktop (or disable/enable dsh-netxops).')
