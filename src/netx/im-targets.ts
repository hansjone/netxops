/**
 * Parse / format / resolve IM delivery target lists for multi-sink alarm push.
 */

export interface ImDeliveryTarget {
  botId: string
  targetId: string
}

/**
 * Stable key for one bot+target pair.
 * @param botId - opaque bot id.
 * @param targetId - opaque target id.
 */
export function imTargetKey(botId: string, targetId: string): string {
  return `${botId}::${targetId}`
}

/**
 * Parse {@link imTargetKey}.
 * @param value - encoded key.
 */
export function parseImTargetKey(value: string): ImDeliveryTarget {
  const at = value.indexOf('::')
  if (at <= 0) return { botId: '', targetId: '' }
  return { botId: value.slice(0, at), targetId: value.slice(at + 2) }
}

/**
 * Normalize one target; empty strings become absent.
 * @param input - raw target.
 */
export function normalizeImTarget(input: unknown): ImDeliveryTarget | null {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return null
  const row = input as Record<string, unknown>
  const botId = typeof row.botId === 'string' ? row.botId.trim() : ''
  const targetId = typeof row.targetId === 'string' ? row.targetId.trim() : ''
  if (!botId || !targetId) return null
  return { botId, targetId }
}

/**
 * Parse the settings JSON string for `imTargets`.
 * @param text - stored settings value.
 */
export function parseImTargetsJson(text: string): ImDeliveryTarget[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const out: ImDeliveryTarget[] = []
  const seen = new Set<string>()
  for (const entry of parsed) {
    const target = normalizeImTarget(entry)
    if (!target) continue
    const key = imTargetKey(target.botId, target.targetId)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(target)
  }
  return out
}

/**
 * Serialize targets for the `imTargets` settings field.
 * @param targets - selected sinks.
 */
export function formatImTargetsJson(targets: readonly ImDeliveryTarget[]): string {
  const seen = new Set<string>()
  const rows: ImDeliveryTarget[] = []
  for (const entry of targets) {
    const target = normalizeImTarget(entry)
    if (!target) continue
    const key = imTargetKey(target.botId, target.targetId)
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(target)
  }
  return rows.length === 0 ? '' : JSON.stringify(rows)
}

/**
 * Resolve effective sinks: prefer `imTargets` JSON; else legacy single bot/target pair.
 * @param settings - settings snapshot fields.
 */
export function resolveImTargets(settings: {
  imTargets?: string
  imBotId?: string
  imTargetId?: string
}): ImDeliveryTarget[] {
  const fromList = parseImTargetsJson(
    typeof settings.imTargets === 'string' ? settings.imTargets : '',
  )
  if (fromList.length > 0) return fromList
  const legacy = normalizeImTarget({
    botId: settings.imBotId,
    targetId: settings.imTargetId,
  })
  return legacy ? [legacy] : []
}

/**
 * Toggle one catalog option in the selected set.
 * @param current - current selection.
 * @param target - option to toggle.
 * @param selected - whether it should be selected after the toggle.
 */
export function setImTargetSelected(
  current: readonly ImDeliveryTarget[],
  target: ImDeliveryTarget,
  selected: boolean,
): ImDeliveryTarget[] {
  const key = imTargetKey(target.botId, target.targetId)
  const without = current.filter(
    (row) => imTargetKey(row.botId, row.targetId) !== key,
  )
  if (!selected) return without
  const normalized = normalizeImTarget(target)
  return normalized ? [...without, normalized] : without
}
