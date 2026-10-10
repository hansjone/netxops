/**
 * Ensure the Host bridge row `dsh-netxops` exists in desktop/web profile patches.
 *
 * Two independent install channels drift apart after dirty reinstalls:
 * - Preset channel: `ensureAgentPresetInstalled` rewrites the managed
 *   `preset-netxops` block into `cordis.patch.yml` on every Host apply.
 * - Host channel: normally comes from the package `cordis.bundle.patch.yml`
 *   insert, merged only while the bundle stays selected.
 *
 * When the bundle host insert is lost, Netx Ops preset + `netxops-tools` can
 * still load, but `getNetxConnection()` stays undefined forever → no tools.
 * Call this from Host apply **and** from the preset tools plugin (chicken-egg
 * recovery when only the preset side is still alive).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'

const DESKTOP_PATCH_BEGIN = '# BEGIN dsh-netxops-preset (managed)'
const DESKTOP_PATCH_END = '# END dsh-netxops-preset (managed)'

const HOST_HEAL_ONCE = Symbol.for('dsh-netxops.host-bridge-heal-attempted')

/** Defaults merged into missing keys only — never overwrite user values. */
export const NETXOPS_HOST_CONFIG_DEFAULTS: Readonly<Record<string, string | boolean | number>> = Object.freeze({
  apiUrl: 'http://127.0.0.1:8890',
  lang: 'zh',
  thinkingLanguage: 'auto',
  replyLanguage: 'follow-user',
  nmsProvider: 'zte-ume',
  tokenCredentialRef: 'NETX_API_TOKEN',
  toolCallTimeoutMs: 120_000,
  installAgentPreset: true,
  alarmPushEnabled: false,
  alarmDeliverDsh: true,
  alarmDeliverIm: false,
  imBotId: '',
  imTargetId: '',
  imTargets: '',
  groupOpsInPreset: true,
  /** Default on: other presets inherit ops tools/skills after install. */
  groupOpsPublic: true,
  groupTopologyInPreset: false,
  groupTopologyPublic: false,
  groupBizMonitorInPreset: true,
  groupBizMonitorPublic: false,
  kbRoot: '',
  groupKbInPreset: true,
  groupKbPublic: false,
})

export interface HostBridgeHealResult {
  rewritten: number
  inserted: number
}

function resolveDshHome(): string {
  const fromEnv = process.env.DSH_HOME?.trim()
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv
  return join(homedir(), '.dsh')
}

function managedLineMask(lines: string[]): boolean[] {
  const skip = lines.map(() => false)
  let inside = false
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!
    if (line.includes(DESKTOP_PATCH_BEGIN)) inside = true
    if (inside) skip[i] = true
    if (line.includes(DESKTOP_PATCH_END)) inside = false
  }
  return skip
}

function parseScalar(raw: string): string | boolean | number {
  const text = raw.trim()
  if (text === 'true') return true
  if (text === 'false') return false
  if (/^-?\d+$/.test(text)) return Number(text)
  if (
    (text.startsWith('"') && text.endsWith('"'))
    || (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1)
  }
  return text
}

function formatScalar(value: string | boolean | number): string {
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  if (value === '') return "''"
  if (/[:#\n\r]|^\s|\s$/.test(value) || value.includes("'")) {
    return JSON.stringify(value)
  }
  return value
}

interface HostEntry {
  start: number
  end: number
  disabled?: boolean
  name?: string
  config: Record<string, string | boolean | number>
}

function findHostEntry(lines: string[], skip: boolean[]): HostEntry | null {
  for (let i = 0; i < lines.length; i += 1) {
    if (skip[i]) continue
    if (lines[i] !== '- id: netxops') continue
    let end = i + 1
    while (end < lines.length) {
      const line = lines[end]!
      if (skip[end]) break
      if (/^- id:/.test(line)) break
      end += 1
    }
    while (end > i + 1 && lines[end - 1]!.trim() === '') end -= 1

    let disabled: boolean | undefined
    let name: string | undefined
    const config: Record<string, string | boolean | number> = {}
    let inConfig = false
    for (let j = i + 1; j < end; j += 1) {
      const line = lines[j]!
      const disabledMatch = /^  disabled:\s*(.+)\s*$/.exec(line)
      if (disabledMatch) {
        disabled = parseScalar(disabledMatch[1]!) === true
        inConfig = false
        continue
      }
      const nameMatch = /^  name:\s*(.+)\s*$/.exec(line)
      if (nameMatch) {
        name = String(parseScalar(nameMatch[1]!))
        inConfig = false
        continue
      }
      if (/^  config:\s*$/.test(line)) {
        inConfig = true
        continue
      }
      if (inConfig) {
        const cfg = /^    ([A-Za-z0-9_]+):\s*(.*?)\s*$/.exec(line)
        if (cfg) {
          config[cfg[1]!] = parseScalar(cfg[2]!)
          continue
        }
        if (/^  \S/.test(line)) inConfig = false
      }
    }
    return { start: i, end, disabled, name, config }
  }
  return null
}

/** True when any non-managed row already names the host package (insert or id form). */
function hostBridgeNamedElsewhere(lines: string[], skip: boolean[]): boolean {
  for (let i = 0; i < lines.length; i += 1) {
    if (skip[i]) continue
    if (/^\s+name:\s*['"]?dsh-netxops['"]?\s*$/.test(lines[i]!)) return true
  }
  return false
}

function needsHeal(entry: HostEntry): boolean {
  if (entry.name !== 'dsh-netxops') return true
  for (const key of Object.keys(NETXOPS_HOST_CONFIG_DEFAULTS)) {
    if (!Object.hasOwn(entry.config, key)) return true
  }
  return false
}

function renderHostEntry(entry: Pick<HostEntry, 'disabled' | 'name' | 'config'>): string[] {
  const config = { ...NETXOPS_HOST_CONFIG_DEFAULTS, ...entry.config }
  const out: string[] = [
    '- id: netxops',
    '  name: dsh-netxops',
  ]
  if (entry.disabled === true) out.push('  disabled: true')
  else out.push('  disabled: false')
  out.push('  config:')
  for (const [key, value] of Object.entries(config)) {
    out.push(`    ${key}: ${formatScalar(value)}`)
  }
  return out
}

/**
 * Insert or expand the Host `dsh-netxops` row in desktop/web `cordis.patch.yml`.
 * @returns counts of profiles rewritten (sparse) vs freshly inserted (missing).
 */
export function ensureNetxopsHostInProfilePatches(logger: Context['logger']): HostBridgeHealResult {
  let rewritten = 0
  let inserted = 0
  for (const profileName of ['desktop', 'web'] as const) {
    const profileDir = join(resolveDshHome(), 'profiles', profileName)
    const patchPath = join(profileDir, 'cordis.patch.yml')
    if (!existsSync(profileDir)) continue
    const raw = existsSync(patchPath) ? readFileSync(patchPath, 'utf8') : ''
    const nl = raw.includes('\r\n') ? '\r\n' : '\n'
    const lines = raw.length > 0 ? raw.replace(/\r\n/g, '\n').split('\n') : []
    const skip = managedLineMask(lines)
    const entry = findHostEntry(lines, skip)

    let nextLines: string[] | null = null
    let kind: 'insert' | 'rewrite' | null = null

    if (entry === null) {
      if (hostBridgeNamedElsewhere(lines, skip)) continue
      const rendered = renderHostEntry({ disabled: false, config: {} })
      const beginIdx = lines.findIndex((line) => line.includes(DESKTOP_PATCH_BEGIN))
      if (beginIdx >= 0) {
        nextLines = [...lines.slice(0, beginIdx), ...rendered, '', ...lines.slice(beginIdx)]
      } else if (lines.length === 0 || (lines.length === 1 && lines[0]!.trim() === '')) {
        nextLines = [...rendered, '']
      } else {
        const body = [...lines]
        while (body.length > 0 && body[body.length - 1]!.trim() === '') body.pop()
        nextLines = [...body, '', ...rendered, '']
      }
      kind = 'insert'
    } else if (needsHeal(entry)) {
      nextLines = [
        ...lines.slice(0, entry.start),
        ...renderHostEntry(entry),
        ...lines.slice(entry.end),
      ]
      kind = 'rewrite'
    }

    if (nextLines === null || kind === null) continue
    const normalized = nextLines.join(nl)
    const withNl = normalized.endsWith(nl) ? normalized : `${normalized}${nl}`
    if (withNl === raw) continue
    writeFileSync(patchPath, withNl, 'utf8')
    if (kind === 'insert') {
      inserted += 1
      logger.error(
        'netxops: host bridge dsh-netxops was MISSING from profiles/%s/cordis.patch.yml — '
        + 'wrote it back. Fully quit and restart %s once so the host publishes the connection '
        + '(preset-only installs leave netxops-tools waiting forever).',
        profileName,
        profileName === 'desktop' ? 'Desktop' : 'dsh web',
      )
    } else {
      rewritten += 1
      logger.info(
        'netxops: healed sparse host entry in profiles/%s/cordis.patch.yml '
        + '(public toggles hot-reload via settings; restart %s only if tools still missing)',
        profileName,
        profileName === 'desktop' ? 'Desktop' : 'dsh web',
      )
    }
  }
  return { rewritten, inserted }
}

/** @deprecated Use {@link ensureNetxopsHostInProfilePatches}. */
export function healNetxopsProfileEntries(logger: Context['logger']): number {
  const result = ensureNetxopsHostInProfilePatches(logger)
  return result.rewritten + result.inserted
}

/**
 * Preset-side chicken-egg recovery: when tools mount with no connection, try
 * once per process to restore the missing Host bridge into the profile patch.
 */
export function tryRecoverMissingHostBridge(logger: Context['logger'], pluginName: string): void {
  const root = globalThis as typeof globalThis & { [HOST_HEAL_ONCE]?: boolean }
  if (root[HOST_HEAL_ONCE] === true) return
  root[HOST_HEAL_ONCE] = true
  try {
    const result = ensureNetxopsHostInProfilePatches(logger)
    if (result.inserted === 0 && result.rewritten === 0) {
      logger.warn(
        '%s: no connection yet — host settings bridge not publishing. '
        + 'Check that profile cordis.yml contains name: dsh-netxops (not only preset-netxops). '
        + 'Recovery: dsh plugin remove dsh-netxops && dsh plugin add …, then fully restart.',
        pluginName,
      )
    }
  } catch (error) {
    logger.warn('%s: host-bridge recover failed: %s', pluginName, error)
  }
}
