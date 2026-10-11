/**
 * DSH tool outputs must be lossless JSON: no `undefined` property values,
 * no NaN/Infinity, no class instances. Build plain objects carefully, or
 * round-trip through JSON before returning from a tool.
 */

import type { NetxJson } from './http.ts'
export type LosslessJsonValue = string | number | boolean | null | LosslessJsonValue[] | { [key: string]: LosslessJsonValue }

/**
 * Detach a plain JSON-compatible value for DSH tool results.
 * Drops object keys whose value is `undefined` (via JSON.stringify).
 * @param value - handler result (may contain undefined holes).
 * @returns parsed plain JSON object, or a safe error envelope.
 */
export function toLosslessJson(value: unknown): Record<string, LosslessJsonValue> {
  try {
    const text = JSON.stringify(value)
    if (text === undefined) {
      return { ok: false, error: 'tool_result_not_json', detail: 'undefined_root' }
    }
    const parsed = JSON.parse(text) as LosslessJsonValue
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed
    }
    return { ok: true, data: { value: parsed } }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return { ok: false, error: 'tool_result_not_json', detail: detail.slice(0, 400) }
  }
}

/**
 * Build a record omitting keys whose value is `undefined` (keeps null).
 */
export function omitUndefined(record: Record<string, unknown>): NetxJson {
  const out: NetxJson = {}
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) out[key] = value as NetxJson[string]
  }
  return out
}
