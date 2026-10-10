/**
 * Heal sparse Desktop/Web profile overrides for the host `netxops` row.
 *
 * Plugin Manager often writes only:
 *   - id: netxops
 *     disabled: false
 * On DSH 0.2 that override **replaces the whole Config**, so capability /
 * public flags never land unless we re-expand the entry. Call this on Host
 * apply so every install (not just hand-edited machines) gets a usable row.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'

const DESKTOP_PATCH_BEGIN = '# BEGIN dsh-netxops-preset (managed)'
const DESKTOP_PATCH_END = '# END dsh-netxops-preset (managed)'

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

function needsHeal(entry: HostEntry): boolean {
  if (entry.name !== 'dsh-netxops') return true
  for (const key of Object.keys(NETXOPS_HOST_CONFIG_DEFAULTS)) {
    if (!Object.hasOwn(entry.config, key)) return true
  }
  return false
}

function renderHostEntry(entry: HostEntry): string[] {
  const config = { ...NETXOPS_HOST_CONFIG_DEFAULTS, ...entry.config }
  const out: string[] = [
    '- id: netxops',
    "  name: dsh-netxops",
  ]
  if (entry.disabled === true) out.push('  disabled: true')
  else if (entry.disabled === false) out.push('  disabled: false')
  out.push('  config:')
  for (const [key, value] of Object.entries(config)) {
    out.push(`    ${key}: ${formatScalar(value)}`)
  }
  return out
}

/**
 * Expand sparse `netxops` host overrides in desktop/web profile patches.
 * @returns number of profiles rewritten.
 */
export function healNetxopsProfileEntries(logger: Context['logger']): number {
  let rewritten = 0
  for (const profileName of ['desktop', 'web'] as const) {
    const patchPath = join(resolveDshHome(), 'profiles', profileName, 'cordis.patch.yml')
    if (!existsSync(patchPath)) continue
    const raw = readFileSync(patchPath, 'utf8')
    const nl = raw.includes('\r\n') ? '\r\n' : '\n'
    const lines = raw.replace(/\r\n/g, '\n').split('\n')
    // Drop trailing empty split artifact for rewrite math; re-join with file nl.
    const skip = managedLineMask(lines)
    const entry = findHostEntry(lines, skip)
    if (entry === null) continue
    if (!needsHeal(entry)) continue
    const rendered = renderHostEntry(entry)
    const next = [
      ...lines.slice(0, entry.start),
      ...rendered,
      ...lines.slice(entry.end),
    ].join(nl)
    const normalized = next.endsWith(nl) ? next : `${next}${nl}`
    if (normalized === raw) continue
    writeFileSync(patchPath, normalized, 'utf8')
    rewritten += 1
    logger.info(
      'netxops: healed sparse host entry in profiles/%s/cordis.patch.yml (restart %s to load capability defaults)',
      profileName,
      profileName === 'desktop' ? 'Desktop' : 'dsh web',
    )
  }
  return rewritten
}
