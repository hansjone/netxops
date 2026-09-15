/**
 * Dynamic `kb-context` skill — model-visible annotation of the KB snapshot.
 * Tools/scripts still use `process.env.KB_*` from `applyKbEnv`.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { KbSnapshot } from './kb-manifest.ts'
import { resolveKbLocalRoot } from './kb-local-path.ts'

const SKILL_NAME = 'kb-context'

function skillBody(snapshot: KbSnapshot): { description: string; content: string } {
  if (snapshot.status === 'configured') {
    const flags = Object.entries(snapshot.content)
      .filter(([, on]) => on)
      .map(([key]) => key)
      .join(', ') || '(none)'
    const localRoot = resolveKbLocalRoot(snapshot)
    const localRow = localRoot
      ? `| kbLocal | \`${localRoot}\` |`
      : '| kbLocal | (MANIFEST paths.local missing) |'
    const localGuide = localRoot
      ? [
          '',
          '### Dual plane (mandatory)',
          '',
          '- **HQ pack = read-only** (formal RCA, theory, packet, `_common`, `_skills`, shared cmdLib).',
          `- **Writable evolution core**: \`${localRoot}\` → \`refs/\` | \`memories/\` | \`drafts/\` | \`suggestions/\`.`,
          '- **All KB writes via host tools** (workspace Write/bash cannot reach KB):',
          '  `netx__kbWriteRef` / `netx__kbWriteMemory` / `netx__kbWriteDraft` / `netx__kbWriteSuggestion` /',
          '  `netx__kbUpdateLocal` / `netx__kbDeleteLocal` / `netx__kbListLocal`.',
          '',
          '### refs — site product knowledge (evolve every task)',
          '- On any NE: **read** `refs/devices/<host_name>/` first; if missing, prove with netx then `kbWriteRef` to create/update.',
          '- `area=devices` requires `device=<host_name>` (never UUID); primary file slug=`PROFILE`.',
          '- Also: `inventory` (ledger), `topology`, `business`, `commands` (site-only), `handbooks`.',
          '- Device facts → refs; episodic experience → memories (do not dump ledgers into diaries).',
          '',
          '### memories — write immediately when valuable',
          '- `bucket=note` | `rca_review` | `ai_trace` — short beats lost.',
          '- Open cases → `kbWriteDraft`. HQ pack gaps → `kbWriteSuggestion`.',
        ]
      : [
          '',
          'No local write tools until `paths.local` is present in MANIFEST.',
        ]
    return {
      description:
        'Operator knowledge-base context for this Host (HQ pack + local evolution under paths.local).',
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
        localRow,
        `| kbOperator | ${snapshot.operatorName} |`,
        `| kbCountry | ${snapshot.country} |`,
        `| kbVersion | ${snapshot.version} |`,
        `| kbContent (on) | ${flags} |`,
        ...localGuide,
        '',
        'Environment mirrors: KB_ROOT, KB_LOCAL, KB_OPERATOR, KB_COUNTRY, KB_VERSION, KB_CONTENT, KB_STATUS.',
        '',
        'Business playbooks (kb-troubleshoot, kb-retrieve, …) register from',
        `${snapshot.realRoot}/_skills/ (or MANIFEST paths.skills) when hasSkills is true,`,
        'plus paths.localSkills when present — use those skills for KB triage;',
        'keep netx-ops for live netx evidence only.',
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
      `kbStatus=${snapshot.status}. ${reason}`,
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
