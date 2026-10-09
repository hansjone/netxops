/**
 * Install Netx Ops agent preset for both DSH host styles:
 *
 * - Web / source CLI (`@deepseek-ai/dsh-agent-presets`): directory under
 *   `$DSH_HOME/.agent-presets/netxops`.
 * - Desktop 0.2 (`@deepseek-ai/dsh-agent-preset` + registry): declarative
 *   insert row in `presets/netxops.preset.patch.yml`, synced into the desktop
 *   profile `cordis.patch.yml` on apply (not the package bundle — keeps web safe).
 *
 * Both are composed from the host shipped `standard` + Netx Ops overlays
 * (DSH has no preset `extends`).
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'

export const NETXOPS_PRESET_ID = 'netxops'

const DESKTOP_PATCH_BEGIN = '# BEGIN dsh-netxops-preset (managed)'
const DESKTOP_PATCH_END = '# END dsh-netxops-preset (managed)'

function packageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..')
}

function resolveDshHome(): string {
  const fromEnv = process.env.DSH_HOME?.trim()
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv
  return join(homedir(), '.dsh')
}

/** Locate the shipped `standard` preset directory on this machine. */
export function resolveStandardPresetDir(): string | null {
  const dshHome = resolveDshHome()
  const candidates = [
    join(dshHome, 'profiles', 'node_modules', '@deepseek-ai', 'dsh-agent-presets', 'presets', 'standard'),
    join(dshHome, 'profiles', 'web', 'node_modules', '@deepseek-ai', 'dsh-agent-presets', 'presets', 'standard'),
    join(dshHome, 'profiles', 'desktop', 'node_modules', '@deepseek-ai', 'dsh-agent-presets', 'presets', 'standard'),
    // Source checkout used by `dsh` CLI / local Harness.
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'DeepSeekHarness', 'packages', 'preset', 'agent-presets', 'presets', 'standard'),
  ]
  for (const dir of candidates) {
    if (existsSync(join(dir, 'agent.cordis.yml'))) return dir
  }
  for (const nm of [
    join(dshHome, 'profiles', 'node_modules'),
    join(dshHome, 'profiles', 'web', 'node_modules'),
    join(dshHome, 'profiles', 'desktop', 'node_modules'),
  ]) {
    const pkgJson = join(nm, '@deepseek-ai', 'dsh-agent-presets', 'package.json')
    if (!existsSync(pkgJson)) continue
    try {
      const req = createRequire(pkgJson)
      const root = dirname(req.resolve('@deepseek-ai/dsh-agent-presets/package.json'))
      const dir = join(root, 'presets', 'standard')
      if (existsSync(join(dir, 'agent.cordis.yml'))) return dir
    } catch {
      // try next
    }
  }
  try {
    const req = createRequire(import.meta.url)
    const root = dirname(req.resolve('@deepseek-ai/dsh-agent-presets/package.json'))
    const dir = join(root, 'presets', 'standard')
    if (existsSync(join(dir, 'agent.cordis.yml'))) return dir
  } catch {
    // not resolvable from this package
  }
  return null
}

function replaceTopLevelEntry(cordis: string, id: string, replacement: string): string {
  const lines = cordis.replace(/\r\n/g, '\n').split('\n')
  const start = lines.findIndex((line) => line === `- id: ${id}`)
  const block = replacement.replace(/\r\n/g, '\n').trimEnd().split('\n')
  if (start < 0) {
    return `${cordis.replace(/\r\n/g, '\n').trimEnd()}\n\n${block.join('\n')}\n`
  }
  let end = start + 1
  while (end < lines.length && !lines[end]!.startsWith('- id:')) end += 1
  while (end > start + 1 && lines[end - 1]!.trim() === '') end -= 1
  return [...lines.slice(0, start), ...block, '', ...lines.slice(end)].join('\n').replace(/\n{3,}/g, '\n\n')
}

function ensureNetxopsToolsRow(cordis: string): string {
  if (/^- id: netxops-tools$/m.test(cordis)) return cordis
  const row = '- id: netxops-tools\n  name: dsh-netxops/tools'
  if (/^- id: tool-skill$/m.test(cordis)) {
    const lines = cordis.replace(/\r\n/g, '\n').split('\n')
    const start = lines.findIndex((line) => line === '- id: tool-skill')
    let end = start + 1
    while (end < lines.length && !lines[end]!.startsWith('- id:')) end += 1
    while (end > start + 1 && lines[end - 1]!.trim() === '') end -= 1
    return [...lines.slice(0, end), '', ...row.split('\n'), '', ...lines.slice(end)].join('\n').replace(/\n{3,}/g, '\n\n')
  }
  return `${cordis.replace(/\r\n/g, '\n').trimEnd()}\n\n${row}\n`
}

function personaEntryFromMarkdown(md: string): string {
  const body = md.replace(/\r\n/g, '\n').replace(/^#[^\n]*\n+/u, '').replace(/\n+$/u, '')
  const indented = body.split('\n').map((line) => `      ${line}`).join('\n')
  return [
    '- id: persona',
    "  name: '@deepseek-ai/dsh-persona'",
    '  config:',
    '    suffix: Your working directory is {{cwd}}.',
    '    # Body from presets/netxops/PERSONA.md (composed onto standard).',
    '    prefix: |-',
    indented,
  ].join('\n')
}

export interface NetxopsPresetArtifacts {
  standardDir: string
  name: string
  description: string
  order: string
  /** Full agent.cordis.yml body (standard + overlays). */
  agentCordis: string
  /** Declarative `@deepseek-ai/dsh-agent-preset` patch YAML. */
  declarativePatch: string
}

function readPresetMeta(metaPath: string): { name: string; description: string; order: string } {
  const metaText = readFileSync(metaPath, 'utf8')
  return {
    name: (metaText.match(/^name:\s*(.+)$/m) || [])[1]?.trim() || 'Netx Ops',
    description: (metaText.match(/^description:\s*(.+)$/m) || [])[1]?.trim() || '',
    order: (metaText.match(/^order:\s*(\d+)/m) || [])[1] || '50',
  }
}

/** Compose standard + Netx Ops overlays into directory + declarative artifacts. */
export function composeNetxopsPresetArtifacts(): NetxopsPresetArtifacts {
  const overlayRoot = join(packageRoot(), 'presets', NETXOPS_PRESET_ID)
  const personaPath = join(overlayRoot, 'PERSONA.md')
  const metaPath = join(overlayRoot, 'preset.yml')
  if (!existsSync(personaPath) || !existsSync(metaPath)) {
    throw new Error(`bundled preset overlay missing under ${overlayRoot}`)
  }
  const standardDir = resolveStandardPresetDir()
  if (standardDir === null) {
    throw new Error('cannot find shipped standard preset (@deepseek-ai/dsh-agent-presets)')
  }
  const meta = readPresetMeta(metaPath)
  let agentCordis = replaceTopLevelEntry(
    readFileSync(join(standardDir, 'agent.cordis.yml'), 'utf8'),
    'persona',
    personaEntryFromMarkdown(readFileSync(personaPath, 'utf8')),
  )
  agentCordis = ensureNetxopsToolsRow(agentCordis)
  if (!agentCordis.endsWith('\n')) agentCordis += '\n'

  // Match dsh-web-app/presets/*.patch.yml: plugins items are indented 10 spaces
  // under `        plugins:` (8). Same-level `- id:` makes YAML treat them as
  // siblings of `plugins` and the declaration fails to mount.
  const pluginsBody = agentCordis
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => (line.length === 0 ? '' : `          ${line}`))
    .join('\n')

  const declarativePatch = `# Declarative Netx Ops preset for Desktop 0.2 (@deepseek-ai/dsh-agent-preset).
# Generated from host \`standard\` + presets/netxops overlays — do not hand-edit.
# Regenerate: bun run scripts/gen-preset-patch.mjs

- insert:
    - id: preset-netxops
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: netxops
        order: ${meta.order}
        name: ${JSON.stringify(meta.name)}
        description: ${JSON.stringify(meta.description)}
        plugins:
${pluginsBody}
`
  return { standardDir, ...meta, agentCordis, declarativePatch }
}

function installDirectoryPreset(artifacts: NetxopsPresetArtifacts, logger: Context['logger']): void {
  const overlayRoot = join(packageRoot(), 'presets', NETXOPS_PRESET_ID)
  const destParent = join(resolveDshHome(), '.agent-presets')
  const dest = join(destParent, NETXOPS_PRESET_ID)
  mkdirSync(destParent, { recursive: true })
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true })
  cpSync(artifacts.standardDir, dest, { recursive: true })
  writeFileSync(join(dest, 'preset.yml'), readFileSync(join(overlayRoot, 'preset.yml'), 'utf8'))
  writeFileSync(join(dest, 'PERSONA.md'), readFileSync(join(overlayRoot, 'PERSONA.md'), 'utf8'))
  writeFileSync(join(dest, 'agent.cordis.yml'), artifacts.agentCordis)
  const skillsSrc = join(overlayRoot, 'skills')
  if (existsSync(skillsSrc)) cpSync(skillsSrc, join(dest, 'skills'), { recursive: true })
  writeFileSync(
    join(dest, '.dsh-netxops-managed'),
    [
      'composed-from: standard',
      `standard-source: ${artifacts.standardDir}`,
      `at: ${new Date().toISOString()}`,
      '',
    ].join('\n'),
    'utf8',
  )
  logger.info('netxops: directory preset composed from standard → %s', dest)
}

/**
 * Sync declarative preset into Desktop's cordis.patch.yml.
 * Desktop 0.2 profile roots are empty `[]` (bundles + patch compose the tree),
 * so we key off the profile name — never web's directory roster.
 */
function syncDeclarativeIntoProfilePatch(
  profileName: string,
  declarativePatch: string,
  logger: Context['logger'],
): void {
  if (profileName !== 'desktop') return
  const profileDir = join(resolveDshHome(), 'profiles', profileName)
  const patchPath = join(profileDir, 'cordis.patch.yml')
  if (!existsSync(profileDir)) return

  let patch = existsSync(patchPath) ? readFileSync(patchPath, 'utf8') : '[]\n'
  // Drop previous managed blocks (literal markers — do not RegExp `(managed)`).
  patch = stripManagedPresetBlocks(patch)
  // Drop a bare enable stub left by older installs.
  patch = patch.replace(/^- id: preset-netxops\n(?:  .*\n)*/m, '')
  if (patch.trim() === '' || patch.trim() === '[]') patch = ''
  if (!patch.endsWith('\n') && patch.length > 0) patch += '\n'

  const managed = `${DESKTOP_PATCH_BEGIN}\n${declarativePatch.trimEnd()}\n${DESKTOP_PATCH_END}\n`
  writeFileSync(patchPath, `${patch}${managed}`, 'utf8')
  logger.info('netxops: declarative preset synced into profiles/%s/cordis.patch.yml (restart Desktop to load)', profileName)
}

/** Remove every BEGIN…END managed block using literal index search (markers contain `()`). */
function stripManagedPresetBlocks(patch: string): string {
  let out = patch
  for (;;) {
    const start = out.indexOf(DESKTOP_PATCH_BEGIN)
    if (start < 0) break
    const end = out.indexOf(DESKTOP_PATCH_END, start)
    if (end < 0) {
      out = out.slice(0, start)
      break
    }
    let cut = end + DESKTOP_PATCH_END.length
    if (out[cut] === '\r') cut += 1
    if (out[cut] === '\n') cut += 1
    out = `${out.slice(0, start)}${out.slice(cut)}`
  }
  return out
}

/**
 * Build directory preset (web) + sync declarative patch into Desktop profiles.
 */
export function ensureAgentPresetInstalled(logger: Context['logger']): void {
  let artifacts: NetxopsPresetArtifacts
  try {
    artifacts = composeNetxopsPresetArtifacts()
  } catch (error) {
    logger.warn('netxops: skip preset install: %s', error)
    return
  }
  try {
    installDirectoryPreset(artifacts, logger)
  } catch (error) {
    logger.error('netxops: failed to install directory preset: %s', error)
  }
  try {
    // Refresh shipped declarative file inside the package for next bundle consumers.
    writeFileSync(join(packageRoot(), 'presets', 'netxops.preset.patch.yml'), artifacts.declarativePatch)
  } catch {
    // package may be read-only in some installs
  }
  try {
    for (const profile of ['desktop', 'web']) {
      syncDeclarativeIntoProfilePatch(profile, artifacts.declarativePatch, logger)
    }
  } catch (error) {
    logger.error('netxops: failed to sync declarative preset into profile patch: %s', error)
  }
}
