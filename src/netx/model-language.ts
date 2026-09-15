/**
 * Model thinking / reply language control via systemPrompt injection.
 * Host-global: applies to every agent preset on this Host.
 */

export const THINKING_LANGUAGE_DEFAULT = 'auto'
export const REPLY_LANGUAGE_DEFAULT = 'follow-user'

/** Thinking-language ids stored in settings (plus `auto`). */
export const THINKING_LANGUAGE_IDS = ['zh-CN', 'en'] as const

/** Reply-language ids stored in settings (plus `follow-user`). */
export const REPLY_LANGUAGE_IDS = ['zh', 'en'] as const

export type ThinkingLanguageId = (typeof THINKING_LANGUAGE_IDS)[number]
export type ReplyLanguageId = (typeof REPLY_LANGUAGE_IDS)[number]
export type ThinkingLanguageSetting = typeof THINKING_LANGUAGE_DEFAULT | ThinkingLanguageId
export type ReplyLanguageSetting = typeof REPLY_LANGUAGE_DEFAULT | ReplyLanguageId

interface LanguageMeta {
  id: string
  name: string
  native: string
}

const THINKING_META: Record<ThinkingLanguageId, LanguageMeta> = {
  'zh-CN': { id: 'zh-CN', name: 'Simplified Chinese', native: '简体中文' },
  en: { id: 'en', name: 'English', native: 'English' },
}

const REPLY_META: Record<ReplyLanguageId, LanguageMeta> = {
  zh: { id: 'zh', name: 'Simplified Chinese', native: '简体中文' },
  en: { id: 'en', name: 'English', native: 'English' },
}

/** Normalize a stored thinking-language value. */
export function normalizeThinkingLanguage(raw: string | undefined | null): ThinkingLanguageSetting {
  const value = String(raw ?? '').trim()
  if (!value || value === THINKING_LANGUAGE_DEFAULT) return THINKING_LANGUAGE_DEFAULT
  const lower = value.toLowerCase().replace(/_/g, '-')
  if (lower === 'zh' || lower === 'zh-cn' || lower === 'zh-hans' || lower === 'chinese') return 'zh-CN'
  if (lower === 'en' || lower.startsWith('en-') || lower === 'english') return 'en'
  if ((THINKING_LANGUAGE_IDS as readonly string[]).includes(value)) {
    return value as ThinkingLanguageId
  }
  return THINKING_LANGUAGE_DEFAULT
}

/** Normalize a stored reply-language value. */
export function normalizeReplyLanguage(raw: string | undefined | null): ReplyLanguageSetting {
  const value = String(raw ?? '').trim()
  if (!value || value === REPLY_LANGUAGE_DEFAULT || value === 'auto' || value === 'default') {
    return REPLY_LANGUAGE_DEFAULT
  }
  const lower = value.toLowerCase().replace(/_/g, '-')
  if (lower === 'zh' || lower === 'zh-cn' || lower === 'zh-hans' || lower === 'chinese') return 'zh'
  if (lower === 'en' || lower.startsWith('en-') || lower === 'english') return 'en'
  if ((REPLY_LANGUAGE_IDS as readonly string[]).includes(value)) {
    return value as ReplyLanguageId
  }
  return REPLY_LANGUAGE_DEFAULT
}

/**
 * Resolve effective thinking language.
 * `auto` follows DSH locale preference, then browser/system tag, then English.
 */
export function resolveThinkingLanguage(
  setting: string | undefined | null,
  systemLocale?: string | null,
): ThinkingLanguageId {
  const normalized = normalizeThinkingLanguage(setting)
  if (normalized !== THINKING_LANGUAGE_DEFAULT) return normalized
  return languageFromLocale(systemLocale) ?? 'en'
}

/** Map a BCP-47-ish locale tag to a thinking language. */
export function languageFromLocale(locale: string | undefined | null): ThinkingLanguageId | undefined {
  const tag = String(locale ?? '').trim().toLowerCase().replace(/_/g, '-')
  if (!tag) return undefined
  if (tag === 'zh' || tag.startsWith('zh-hans') || tag.startsWith('zh-cn') || tag === 'zh-sg') {
    return 'zh-CN'
  }
  if (tag.startsWith('zh')) return 'zh-CN'
  if (tag === 'en' || tag.startsWith('en-')) return 'en'
  return undefined
}

/**
 * Read `locale.preference` from the settings service when present.
 * Tolerates missing / malformed sections.
 */
export function readSystemLocalePreference(settings: {
  get?: (ns: string) => unknown
} | undefined | null): string | undefined {
  if (!settings || typeof settings.get !== 'function') return undefined
  let section: unknown
  try {
    section = settings.get('locale')
  } catch {
    return undefined
  }
  if (section === null || typeof section !== 'object' || Array.isArray(section)) return undefined
  const preference = (section as Record<string, unknown>).preference
  return typeof preference === 'string' && preference.trim() ? preference.trim() : undefined
}

/** System-prompt section text for thinking language (empty when unresolved). */
export function thinkingInstruction(language: ThinkingLanguageId): string {
  const meta = THINKING_META[language]
  return [
    `The operator configured the language of your thinking/reasoning process: ${meta.native} (${meta.name}).`,
    `Write your entire internal reasoning — chain-of-thought, analysis, planning, and deliberation — in ${meta.name}.`,
    'Keep code, identifiers, file paths, commands, and technical terms as they are.',
    'Your final answer to the user follows the reply-language setting (or the user language when reply language is follow-user); this thinking setting never alone changes the final answer language.',
  ].join(' ')
}

/** Per-step reminder so switches apply on the next model call in existing sessions. */
export function thinkingReminder(language: ThinkingLanguageId): string {
  const meta = THINKING_META[language]
  return [
    `[Thinking language] The operator wants your reasoning/thinking process written in ${meta.native} (${meta.name}).`,
    `Continue your entire chain-of-thought in ${meta.name}.`,
    'Final answer language follows the reply-language setting / user language.',
  ].join(' ')
}

/**
 * System-prompt section for forced reply language.
 * Returns empty string when `follow-user` (no injection).
 */
export function replyInstruction(setting: string | undefined | null): string {
  const normalized = normalizeReplyLanguage(setting)
  if (normalized === REPLY_LANGUAGE_DEFAULT) return ''
  const meta = REPLY_META[normalized]
  return [
    '## Reply language requirement (mandatory)',
    `The operator set Netx Ops reply language to ${meta.native} (${meta.name}).`,
    `You MUST write the entire final reply in ${meta.name} only.`,
    `Do not switch to the user's language even if they write in Chinese, English, or any other language.`,
    'This includes titles, bullet labels (Result / Evidence / Next may stay as English keywords), explanations, summaries, warnings, and error text.',
    'Keep code, commands, file paths, API names, host names, UUIDs, and proper nouns unchanged.',
    'This rule outranks persona wording such as "follow the user language" and outranks language hints in the user message.',
  ].join(' ')
}

/**
 * Per-step reminder for forced reply language.
 * Empty when `follow-user`. Appended after the user message each model call.
 */
export function replyReminder(setting: string | undefined | null): string {
  const normalized = normalizeReplyLanguage(setting)
  if (normalized === REPLY_LANGUAGE_DEFAULT) return ''
  const meta = REPLY_META[normalized]
  return [
    `[Reply language] Mandatory: write your entire final answer in ${meta.native} (${meta.name}).`,
    'Do not answer in the user\'s language. Code/paths/host names stay original.',
  ].join(' ')
}
