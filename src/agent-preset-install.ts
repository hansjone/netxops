/**
 * Install Netx Ops as a user agent-preset by composing from the host's shipped
 * `standard` preset + Netx Ops overlays (persona / tools / skills).
 *
 * DSH has no preset inheritance (`extends`). Copying `standard` at install time
 * is the supported way to stay aligned with the running Harness version without
 * embedding a full standard composition (or `@deepseek-ai/dsh-agent-preset`)
 * inside this package.
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
    // Insert immediately after the tool-skill entry.
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
  // Drop the human-facing H1 (`# Netx Ops 人设…`); the cordis prefix starts at the body.
  const body = md.replace(/\r\n/g, '\n').replace(/^#[^\n]*\n+/u, '').replace(/\n+$/u, '')
  const indented = body.split('\n').map((line) => `      ${line}`).join('\n')
  return [
    '- id: persona',
    "  name: '@deepseek-ai/dsh-persona'",
    '  config:',
    '    suffix: Your working directory is {{cwd}}.',
    '    # Body from presets/netxops/PERSONA.md (composed onto standard at install).',
    '    prefix: |-',
    indented,
  ].join('\n')
}

/**
 * Build `~/.dsh/.agent-presets/netxops` from the host `standard` preset plus
 * Netx Ops persona / tools / skills. Safe to call on every Host apply.
 */
export function ensureAgentPresetInstalled(logger: Context['logger']): void {
  const overlayRoot = join(packageRoot(), 'presets', NETXOPS_PRESET_ID)
  const personaPath = join(overlayRoot, 'PERSONA.md')
  const metaPath = join(overlayRoot, 'preset.yml')
  if (!existsSync(personaPath) || !existsSync(metaPath)) {
    logger.warn('netxops: bundled preset overlay missing under %s — skip install', overlayRoot)
    return
  }

  const standardDir = resolveStandardPresetDir()
  if (standardDir === null) {
    logger.warn(
      'netxops: cannot find shipped standard preset (@deepseek-ai/dsh-agent-presets) — skip user-preset install',
    )
    return
  }

  const destParent = join(resolveDshHome(), '.agent-presets')
  const dest = join(destParent, NETXOPS_PRESET_ID)
  try {
    mkdirSync(destParent, { recursive: true })
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true })
    // Real copy: DSH discovery skips Windows junctions.
    cpSync(standardDir, dest, { recursive: true })

    writeFileSync(join(dest, 'preset.yml'), readFileSync(metaPath, 'utf8'))
    writeFileSync(join(dest, 'PERSONA.md'), readFileSync(personaPath, 'utf8'))

    const standardCordis = readFileSync(join(standardDir, 'agent.cordis.yml'), 'utf8')
    let composed = replaceTopLevelEntry(
      standardCordis,
      'persona',
      personaEntryFromMarkdown(readFileSync(personaPath, 'utf8')),
    )
    composed = ensureNetxopsToolsRow(composed)
    writeFileSync(join(dest, 'agent.cordis.yml'), composed.endsWith('\n') ? composed : `${composed}\n`, 'utf8')

    const skillsSrc = join(overlayRoot, 'skills')
    if (existsSync(skillsSrc)) {
      cpSync(skillsSrc, join(dest, 'skills'), { recursive: true })
    }

    writeFileSync(
      join(dest, '.dsh-netxops-managed'),
      [
        `composed-from: standard`,
        `standard-source: ${standardDir}`,
        `at: ${new Date().toISOString()}`,
        '',
      ].join('\n'),
      'utf8',
    )
    logger.info('netxops: agent preset composed from standard → %s', dest)
  } catch (error) {
    logger.error('netxops: failed to install agent preset: %s', error)
  }
}
