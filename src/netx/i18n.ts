/**
 * Host-plane Netx Ops i18n (alarm prompts / session titles).
 * UI copy lives in `src/client/locales.ts` via dsh-client-locale.
 */

export type NetxLocale = 'zh' | 'en'

export type NetxHostMessageKey =
  | 'alarm.sessionTitle'
  | 'alarm.defaultLabel'
  | 'alarm.action.inserted'
  | 'alarm.action.updated'
  | 'alarm.action.deleted'
  | 'alarm.action.fallback'
  | 'alarm.field.device'
  | 'alarm.field.object'
  | 'alarm.field.severity'
  | 'alarm.field.cause'
  | 'alarm.field.time'
  | 'alarm.analyzeHint'

const ZH: Record<NetxHostMessageKey, string> = {
  'alarm.sessionTitle': 'Netx 关键告警',
  'alarm.defaultLabel': '关键告警',
  'alarm.action.inserted': '告警产生',
  'alarm.action.updated': '告警更新',
  'alarm.action.deleted': '告警清除',
  'alarm.action.fallback': '告警',
  'alarm.field.device': '设备',
  'alarm.field.object': '对象',
  'alarm.field.severity': '级别',
  'alarm.field.cause': '原因',
  'alarm.field.time': '时间',
  'alarm.analyzeHint': '请分析这条关键告警并给出下一步运维建议。',
}

const EN: Record<NetxHostMessageKey, string> = {
  'alarm.sessionTitle': 'Netx key alarm',
  'alarm.defaultLabel': 'Key alarm',
  'alarm.action.inserted': 'Alarm Raised',
  'alarm.action.updated': 'Alarm Updated',
  'alarm.action.deleted': 'Alarm Cleared',
  'alarm.action.fallback': 'Alarm',
  'alarm.field.device': 'Device',
  'alarm.field.object': 'Object',
  'alarm.field.severity': 'Severity',
  'alarm.field.cause': 'Cause',
  'alarm.field.time': 'Time',
  'alarm.analyzeHint': 'Please analyze this key alarm and suggest next ops steps.',
}

const TABLES: Record<NetxLocale, Record<NetxHostMessageKey, string>> = {
  zh: ZH,
  en: EN,
}

/** Map plugin `lang` / Accept-Language-ish values to zh|en (default zh). */
export function normalizeNetxLocale(lang: string | undefined | null): NetxLocale {
  const normalized = String(lang ?? '').trim().toLowerCase()
  if (normalized === 'english' || /^en(?:[-_].*)?$/u.test(normalized)) return 'en'
  return 'zh'
}

/**
 * Translate a host-plane message key.
 * @param key - stable message id.
 * @param lang - plugin lang or locale tag.
 * @param vars - `{name}` replacements.
 */
export function tHost(
  key: NetxHostMessageKey,
  lang: string | undefined | null = 'zh',
  vars?: Record<string, string | number>,
): string {
  const locale = normalizeNetxLocale(lang)
  const template = TABLES[locale][key] ?? TABLES.zh[key] ?? key
  if (vars === undefined) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  ))
}

/** Alarm action verb for prompt headers. */
export function alarmActionLabel(action: string, lang: string | undefined | null): string {
  const normalized = String(action ?? '').trim().toLowerCase()
  if (normalized === 'inserted') return tHost('alarm.action.inserted', lang)
  if (normalized === 'updated') return tHost('alarm.action.updated', lang)
  if (normalized === 'deleted') return tHost('alarm.action.deleted', lang)
  return normalized || tHost('alarm.action.fallback', lang)
}
