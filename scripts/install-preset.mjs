/** Developer fallback: use the same composition and preservation rules as Host activation. */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { composeNetxopsPresetArtifacts, installDirectoryPreset, syncDeclarativeIntoProfilePatch } from '../lib/index.js'

const index = process.argv.indexOf('--profile')
const profile = index < 0 ? 'web' : process.argv[index + 1]
if (!profile || !/^[\w-]+$/.test(profile)) throw new Error('Invalid profile name.')
const dshHome = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
if (!existsSync(join(dshHome, 'profiles', profile, 'package.json'))) {
  throw new Error(`Harness profile is not installed: ${profile}. Start this Host first.`)
}
const artifacts = composeNetxopsPresetArtifacts(profile)
installDirectoryPreset(artifacts, console)
syncDeclarativeIntoProfilePatch(profile, artifacts.declarativePatch, console)
console.log(`Netx Ops preset prepared for ${profile}. Restart this Host to load its patch.`)
