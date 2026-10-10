/**
 * Install Netx Ops agent preset for both DSH host styles:
 *
 * - DSH ≥0.2 (`@deepseek-ai/dsh-agent-preset` + registry): declarative insert
 *   row synced into **desktop and web** profile `cordis.patch.yml` on apply.
 *   Directory `$DSH_HOME/.agent-presets/netxops` is still written for older
 *   hosts that scan `@deepseek-ai/dsh-agent-presets`, but 0.2 web/desktop no
 *   longer load that roster — without the patch row, Settings → Agent presets
 *   shows no Netx Ops entry.
 *
 * Composed from the **host's** shipped `standard` + Netx Ops overlays (DSH has
 * no preset `extends`). Prefer `@deepseek-ai/dsh-web-app/presets/standard.patch.yml`
 * (`workflow-ptc`) when present; refuse to write a composition whose package
 * names cannot resolve from the host anchors.
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

/** Indent of plugin rows inside `dsh-web-app/presets/*.patch.yml`. */
const PATCH_PLUGIN_INDENT = '          '

function packageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..')
}

function resolveDshHome(): string {
  const fromEnv = process.env.DSH_HOME?.trim()
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv
  return join(homedir(), '.dsh')
}

function electronResourcesRoots(): string[] {
  const roots: string[] = []
  const rp = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  if (typeof rp === 'string' && rp.length > 0) roots.push(rp)
  // Packaged Desktop: `<install>/DeepSeek Harness.exe` beside `resources/`.
  roots.push(join(dirname(process.execPath), 'resources'))
  return roots
}

function readableFile(path: string): boolean {
  try {
    readFileSync(path, { encoding: 'utf8', flag: 'r' })
    return true
  } catch {
    return false
  }
}

/**
 * Locate Desktop 0.2's declarative `standard` patch (`workflow-ptc`).
 * Prefer Electron `app.asar` (what the running Desktop actually loads) over
 * `$DSH_HOME/profiles/node_modules` (often the older CLI heal tree).
 */
export function resolveDesktopStandardPatchPath(): string | null {
  const dshHome = resolveDshHome()
  const envOverride = process.env.NETXOPS_STANDARD_PATCH?.trim()
  const candidates: string[] = []
  if (envOverride) candidates.push(envOverride)

  for (const resources of electronResourcesRoots()) {
    candidates.push(
      join(resources, 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-web-app', 'presets', 'standard.patch.yml'),
      join(resources, 'app.asar.unpacked', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-web-app', 'presets', 'standard.patch.yml'),
    )
  }

  const requireAnchors = [
    join(dshHome, 'profiles', 'desktop', 'package.json'),
    join(dshHome, 'profiles', 'desktop', 'node_modules', 'dsh-netxops', 'package.json'),
    join(packageRoot(), 'package.json'),
    join(dshHome, 'profiles', 'node_modules', '@deepseek-ai', 'dsh-web-app', 'package.json'),
    join(dshHome, 'profiles', 'web', 'package.json'),
  ]
  for (const anchor of requireAnchors) {
    if (!existsSync(anchor)) continue
    try {
      const req = createRequire(anchor)
      try {
        candidates.push(req.resolve('@deepseek-ai/dsh-web-app/presets/standard.patch.yml'))
      } catch {
        // older web-app builds do not export the subpath
      }
      const pkg = dirname(req.resolve('@deepseek-ai/dsh-web-app/package.json'))
      candidates.push(join(pkg, 'presets', 'standard.patch.yml'))
    } catch {
      // try next anchor
    }
  }

  for (const path of candidates) {
    if (readableFile(path)) return path
  }
  return null
}

/**
 * Locate the shipped directory `standard` (`agent.cordis.yml`).
 * Profile-local copies win over the shared `$DSH_HOME/profiles/node_modules`
 * heal tree, which is frequently an older CLI generation than Desktop.
 */
export function resolveStandardPresetDir(): string | null {
  const dshHome = resolveDshHome()
  const candidates = [
    join(dshHome, 'profiles', 'desktop', 'node_modules', '@deepseek-ai', 'dsh-agent-presets', 'presets', 'standard'),
    join(dshHome, 'profiles', 'web', 'node_modules', '@deepseek-ai', 'dsh-agent-presets', 'presets', 'standard'),
    // Source checkout used by `dsh` CLI / local Harness.
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'DeepSeekHarness', 'packages', 'preset', 'agent-presets', 'presets', 'standard'),
    // Shared heal tree last — often lags Desktop 0.2.
    join(dshHome, 'profiles', 'node_modules', '@deepseek-ai', 'dsh-agent-presets', 'presets', 'standard'),
  ]
  for (const dir of candidates) {
    if (existsSync(join(dir, 'agent.cordis.yml'))) return dir
  }
  for (const nm of [
    join(dshHome, 'profiles', 'desktop', 'node_modules'),
    join(dshHome, 'profiles', 'web', 'node_modules'),
    join(dshHome, 'profiles', 'node_modules'),
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

/** True when a packaged Desktop install is on disk (asar may be opaque to plain Node). */
export function desktopRuntimeLikelyPresent(): boolean {
  if (typeof process.versions.electron === 'string') return true
  for (const resources of electronResourcesRoots()) {
    if (existsSync(join(resources, 'app.asar'))) return true
  }
  const localAppData = process.env.LOCALAPPDATA?.trim()
  if (localAppData) {
    if (existsSync(join(localAppData, 'Programs', 'DeepSeek Harness', 'resources', 'app.asar'))) {
      return true
    }
  }
  return false
}

/** Host roots used for bare package health checks (same walk shape as DSH discovery). */
export function hostResolveBases(): string[] {
  const dshHome = resolveDshHome()
  const bases: string[] = []
  for (const resources of electronResourcesRoots()) {
    bases.push(join(resources, 'app.asar', 'dsh', 'package.json'))
    bases.push(join(resources, 'app.asar', 'dsh', 'node_modules'))
  }
  const localAppData = process.env.LOCALAPPDATA?.trim()
  if (localAppData) {
    const asarDsh = join(localAppData, 'Programs', 'DeepSeek Harness', 'resources', 'app.asar', 'dsh')
    bases.push(join(asarDsh, 'package.json'), join(asarDsh, 'node_modules'))
  }
  bases.push(
    join(dshHome, 'profiles', 'desktop', 'package.json'),
    join(dshHome, 'profiles', 'desktop', 'node_modules'),
    join(dshHome, 'profiles', 'web', 'package.json'),
    join(dshHome, 'profiles', 'web', 'node_modules'),
    join(dshHome, 'profiles', 'node_modules'),
    join(packageRoot(), 'package.json'),
  )
  // Keep asar paths even when plain Node cannot stat them — Electron can.
  return [...new Set(bases.filter((path) => path.includes('app.asar') || existsSync(path)))]
}

/**
 * Whether a package (optionally with subpath) is installed above any base.
 * Mirrors `@deepseek-ai/dsh-agent-presets` discovery `packageInstalled`.
 */
export function packageInstalledAbove(name: string, bases: readonly string[]): boolean {
  if (name.startsWith('cordis:') || name.startsWith('node:')) return true
  const pkg = name.split('/').slice(0, name.startsWith('@') ? 2 : 1).join('/')
  for (const base of bases) {
    let dir = base.endsWith('package.json') ? dirname(base) : base
    for (;;) {
      if (readableFile(join(dir, 'node_modules', pkg, 'package.json'))) return true
      // Electron asar: packages live under `…/app.asar/dsh/node_modules`.
      if (readableFile(join(dir, pkg, 'package.json'))) return true
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    const requireAnchor = base.endsWith('package.json')
      ? base
      : existsSync(join(base, 'package.json'))
        ? join(base, 'package.json')
        : null
    if (requireAnchor !== null) {
      try {
        createRequire(requireAnchor).resolve(`${pkg}/package.json`)
        return true
      } catch {
        // try next base
      }
    }
  }
  return false
}

/** Package names referenced by top-level / nested `name:` rows in a composition. */
export function collectCompositionPackageNames(yaml: string): string[] {
  const names: string[] = []
  for (const match of yaml.matchAll(/^\s*name:\s*(.+)$/gm)) {
    let raw = match[1]!.trim()
    if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
      raw = raw.slice(1, -1)
    }
    if (raw.length === 0) continue
    if (raw.startsWith('./') || raw.startsWith('../') || raw.startsWith('file:')) continue
    names.push(raw)
  }
  return [...new Set(names)]
}

export function unresolvableCompositionPackages(
  yaml: string,
  bases: readonly string[],
): string[] {
  return collectCompositionPackageNames(yaml).filter((name) => !packageInstalledAbove(name, bases))
}

function remapWorkflowToPtc(cordis: string): string {
  return cordis
    .replaceAll('- id: workflow-worker-thread', '- id: workflow-ptc')
    .replaceAll('@deepseek-ai/dsh-workflow-worker-thread', '@deepseek-ai/dsh-workflow-ptc')
}

function remapWorkflowToWorkerThread(cordis: string): string {
  return cordis
    .replaceAll('- id: workflow-ptc', '- id: workflow-worker-thread')
    .replaceAll('@deepseek-ai/dsh-workflow-ptc', '@deepseek-ai/dsh-workflow-worker-thread')
}

export type WorkflowHostKind = 'desktop' | 'web' | 'auto'

/**
 * Align workflow engine id/name with what the host can resolve.
 * Desktop 0.2 ships `dsh-workflow-ptc`; older CLI standards name
 * `dsh-workflow-worker-thread`. Pass `host: 'desktop' | 'web'` when composing
 * for one surface so a dual-install machine does not poison the other.
 */
export function alignWorkflowEngineForHost(
  cordis: string,
  bases: readonly string[],
  host: WorkflowHostKind = 'auto',
): string {
  const hasPtc = packageInstalledAbove('@deepseek-ai/dsh-workflow-ptc', bases)
  const hasWorker = packageInstalledAbove('@deepseek-ai/dsh-workflow-worker-thread', bases)
  const desktop = host === 'desktop' || (host === 'auto' && desktopRuntimeLikelyPresent())
  if (hasPtc && !hasWorker) return remapWorkflowToPtc(cordis)
  if (hasPtc && hasWorker && desktop) return remapWorkflowToPtc(cordis)
  if (!hasPtc && hasWorker && desktop) {
    // Plain Node cannot see into app.asar; Desktop 0.2 still only has ptc there.
    return remapWorkflowToPtc(cordis)
  }
  if (!hasPtc && !hasWorker && desktop && cordis.includes('workflow-worker-thread')) {
    return remapWorkflowToPtc(cordis)
  }
  if (hasWorker && !hasPtc && !desktop) return remapWorkflowToWorkerThread(cordis)
  if (hasWorker && hasPtc && host === 'web') return remapWorkflowToWorkerThread(cordis)
  return cordis
}

/** Pull the `plugins:` list body (already indented) out of a standard.patch.yml. */
export function extractPluginsBodyFromStandardPatch(patchYaml: string): string {
  const text = patchYaml.replace(/\r\n/g, '\n')
  const marker = /^([ \t]*)plugins:\s*$/m
  const match = marker.exec(text)
  if (match === null) {
    throw new Error('standard.patch.yml has no plugins: block')
  }
  const pluginsKeyIndent = match[1]!.length
  const start = match.index + match[0].length
  const rest = text.slice(start).replace(/^\n/, '')
  const lines = rest.split('\n')
  const body: string[] = []
  for (const line of lines) {
    if (line.trim() === '') {
      body.push(line)
      continue
    }
    const indent = line.match(/^[ \t]*/)?.[0].length ?? 0
    if (indent <= pluginsKeyIndent) break
    body.push(line)
  }
  while (body.length > 0 && body[body.length - 1]!.trim() === '') body.pop()
  return body.join('\n')
}

/** Convert patch-indented plugins body into a top-level `agent.cordis.yml` list. */
export function pluginsBodyToAgentCordis(pluginsBody: string): string {
  const prefix = PATCH_PLUGIN_INDENT
  return `${pluginsBody
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => {
      if (line.length === 0) return ''
      if (line.startsWith(prefix)) return line.slice(prefix.length)
      return line.trimStart()
    })
    .join('\n')
    .trimEnd()}\n`
}

function agentCordisToPluginsBody(agentCordis: string): string {
  return agentCordis
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => (line.length === 0 ? '' : `${PATCH_PLUGIN_INDENT}${line}`))
    .join('\n')
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
  /** Human-readable source path (directory or patch file). */
  standardSource: string
  /** Kind of host standard used for composition. */
  standardKind: 'desktop-patch' | 'directory'
  /** Directory to seed `.agent-presets/netxops` from; null when patch-only. */
  standardDir: string | null
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

function desktopProfilePresent(): boolean {
  return existsSync(join(resolveDshHome(), 'profiles', 'desktop'))
}

/** Compose standard + Netx Ops overlays into directory + declarative artifacts. */
export function composeNetxopsPresetArtifacts(): NetxopsPresetArtifacts {
  const overlayRoot = join(packageRoot(), 'presets', NETXOPS_PRESET_ID)
  const personaPath = join(overlayRoot, 'PERSONA.md')
  const metaPath = join(overlayRoot, 'preset.yml')
  if (!existsSync(personaPath) || !existsSync(metaPath)) {
    throw new Error(`bundled preset overlay missing under ${overlayRoot}`)
  }
  const meta = readPresetMeta(metaPath)
  const bases = hostResolveBases()
  const patchPath = resolveDesktopStandardPatchPath()
  const usePatch = patchPath !== null && (
    process.env.NETXOPS_PREFER_DESKTOP_PATCH !== '0'
  ) && (
    typeof process.versions.electron === 'string'
    || process.env.NETXOPS_PREFER_DESKTOP_PATCH === '1'
    || desktopProfilePresent()
    || desktopRuntimeLikelyPresent()
  )

  let standardSource: string
  let standardKind: 'desktop-patch' | 'directory'
  let standardDir: string | null
  let agentCordis: string

  if (usePatch && patchPath !== null) {
    standardSource = patchPath
    standardKind = 'desktop-patch'
    standardDir = null
    agentCordis = pluginsBodyToAgentCordis(extractPluginsBodyFromStandardPatch(readFileSync(patchPath, 'utf8')))
  } else {
    const dir = resolveStandardPresetDir()
    if (dir === null) {
      throw new Error(
        'cannot find host standard preset (Desktop standard.patch.yml or @deepseek-ai/dsh-agent-presets)',
      )
    }
    standardSource = dir
    standardKind = 'directory'
    standardDir = dir
    agentCordis = readFileSync(join(dir, 'agent.cordis.yml'), 'utf8')
  }

  agentCordis = replaceTopLevelEntry(
    agentCordis,
    'persona',
    personaEntryFromMarkdown(readFileSync(personaPath, 'utf8')),
  )
  agentCordis = ensureNetxopsToolsRow(agentCordis)
  agentCordis = alignWorkflowEngineForHost(agentCordis, bases)
  if (!agentCordis.endsWith('\n')) agentCordis += '\n'

  const missing = unresolvableCompositionPackages(agentCordis, bases)
    .filter((name) => !name.startsWith('dsh-netxops'))
  // Packaged Desktop keeps most `@deepseek-ai/*` only inside app.asar; plain
  // Node cannot probe them, but the Host can. Do not block the write for those.
  const desktopAsar = desktopRuntimeLikelyPresent()
  const blocking = missing.filter((name) => !(desktopAsar && name.startsWith('@deepseek-ai/')))
  if (blocking.length > 0) {
    throw new Error(
      `composed Netx Ops preset names packages the host cannot resolve: ${blocking.join(', ')} `
      + `(standard-source: ${standardSource})`,
    )
  }

  const pluginsBody = agentCordisToPluginsBody(agentCordis)
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
  return { standardSource, standardKind, standardDir, ...meta, agentCordis, declarativePatch }
}

function installDirectoryPreset(artifacts: NetxopsPresetArtifacts, logger: Context['logger']): void {
  const overlayRoot = join(packageRoot(), 'presets', NETXOPS_PRESET_ID)
  const destParent = join(resolveDshHome(), '.agent-presets')
  const dest = join(destParent, NETXOPS_PRESET_ID)
  mkdirSync(destParent, { recursive: true })
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  if (artifacts.standardDir !== null && existsSync(artifacts.standardDir)) {
    cpSync(artifacts.standardDir, dest, { recursive: true })
  }
  writeFileSync(join(dest, 'preset.yml'), readFileSync(join(overlayRoot, 'preset.yml'), 'utf8'))
  writeFileSync(join(dest, 'PERSONA.md'), readFileSync(join(overlayRoot, 'PERSONA.md'), 'utf8'))
  writeFileSync(join(dest, 'agent.cordis.yml'), artifacts.agentCordis)
  const skillsSrc = join(overlayRoot, 'skills')
  if (existsSync(skillsSrc)) cpSync(skillsSrc, join(dest, 'skills'), { recursive: true })
  writeFileSync(
    join(dest, '.dsh-netxops-managed'),
    [
      `composed-from: ${artifacts.standardKind}`,
      `standard-source: ${artifacts.standardSource}`,
      `at: ${new Date().toISOString()}`,
      '',
    ].join('\n'),
    'utf8',
  )
  logger.info(
    'netxops: directory preset composed from %s → %s',
    artifacts.standardSource,
    dest,
  )
}

/**
 * Sync declarative preset into a profile's cordis.patch.yml.
 * DSH ≥0.2 profile roots are empty `[]` (bundles + patch compose the tree).
 * Both `desktop` and `web` need the `@deepseek-ai/dsh-agent-preset` insert;
 * directory `.agent-presets` alone is invisible on 0.2.
 */
function syncDeclarativeIntoProfilePatch(
  profileName: string,
  declarativePatch: string,
  logger: Context['logger'],
): void {
  if (profileName !== 'desktop' && profileName !== 'web') return
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
  logger.info(
    'netxops: declarative preset synced into profiles/%s/cordis.patch.yml (restart %s to load)',
    profileName,
    profileName === 'desktop' ? 'Desktop' : 'dsh web',
  )
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
