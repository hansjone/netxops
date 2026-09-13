/**
 * Dynamic `kb-context` skill — model-visible annotation of the KB snapshot.
 * Tools/scripts still use `process.env.KB_*` from `applyKbEnv`.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { KbSnapshot } from './kb-manifest.ts'

const SKILL_NAME = 'kb-context'

function skillBody(snapshot: KbSnapshot): { description: string; content: string } {
  if (snapshot.status === 'configured') {
    const flags = Object.entries(snapshot.content)
      .filter(([, on]) => on)
      .map(([key]) => key)
      .join(', ') || '(none)'
    return {
      description:
        'Operator knowledge-base context for this Host (paths + identity from MANIFEST).',
      content: [
        '## Knowledge base (configured)',
        '',
        'When troubleshooting with operator playbooks or docs, **compose paths from this root**.',
        'Do not invent another operator or country.',
        '',
        `| Field | Value |`,
        `| --- | --- |`,
        `| kbStatus | configured |`,
        `| kbRoot | \`${snapshot.realRoot}\` |`,
        `| kbOperator | ${snapshot.operatorName} |`,
        `| kbCountry | ${snapshot.country} |`,
        `| kbVersion | ${snapshot.version} |`,
        `| kbContent (on) | ${flags} |`,
        '',
        'Environment mirrors: `KB_ROOT`, `KB_OPERATOR`, `KB_COUNTRY`, `KB_VERSION`, `KB_CONTENT`, `KB_STATUS`.',
      ].join('\n'),
    }
  }

  const reason = snapshot.status === 'error'
    ? (snapshot.errorMessage || 'invalid knowledge base')
    : 'kbRoot is empty'

  return {
    description:
      'Knowledge-base context is unavailable — stay on pure netx evidence.',
    content: [
      '## Knowledge base (unavailable)',
      '',
      `kbStatus=\`${snapshot.status}\`. ${reason}`,
      '',
      '**Do not invent an operator, country, or KB paths.**',
      'Use only netx tools / live evidence (alarms, inventory, CLI, topology).',
      'Operator-specific playbooks are out of scope until a valid MANIFEST is configured.',
    ].join('\n'),
  }
}

/**
 * Register (or replace) the `kb-context` skill for the current snapshot.
 * @returns disposer that unregisters the skill.
 */
export function registerKbContextSkill(
  ctx: Context,
  snapshot: KbSnapshot,
): () => void {
  const skillsApi = (ctx as { skills?: { register: (skill: {
    name: string
    description: string
    content: string
    provider?: string
    source: string
  }) => () => void } }).skills
  if (!skillsApi || typeof skillsApi.register !== 'function') {
    return () => {}
  }
  const body = skillBody(snapshot)
  return skillsApi.register({
    name: SKILL_NAME,
    description: body.description,
    content: body.content,
    provider: 'netxops-kb',
    source: 'custom',
  })
}
