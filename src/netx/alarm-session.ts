/**
 * Deliver a key-alarm into a sticky Netx Ops DSH session (create once, then followup).
 *
 * Soft-depends on host services that the web profile usually provides
 * (agents / agentPresets / workspaceRegistry / permissionPresets / sessionTitle /
 * agentDefaultModel). When any are missing, delivery is skipped with a warning.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { formatAlarmPrompt, type KeyAlarmPayload } from './alarm-push.ts'

const PRESET_ID = 'netxops'
const PERMISSION_PRESET = 'default'
const TITLE = 'Netx 关键告警'

interface StickyHandle {
  sessionId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Agent type varies by DSH version
  agent: any
}

let sticky: StickyHandle | null = null

function resolveWorkspacePath(): string {
  const fromEnv = process.env.DSH_HOME?.trim()
  const home = fromEnv && fromEnv.length > 0 ? fromEnv : join(homedir(), '.dsh')
  return join(home, 'workspaces', 'netxops-alarms')
}

/**
 * Open or reuse a Netx Ops session and append the alarm as a user followup.
 * @param ctx - host cordis context (may lack session services on minimal profiles).
 * @param payload - matched key-alert payload from netx.
 * @param lang - zh / en prompt flavour.
 */
export async function deliverAlarmToSession(
  ctx: Context,
  payload: KeyAlarmPayload,
  lang = 'zh',
): Promise<void> {
  const prompt = formatAlarmPrompt(payload, lang)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agents = (ctx as any).agents
  if (!agents || typeof agents.create !== 'function') {
    ctx.logger.warn(
      'netxops alarm-push: ctx.agents unavailable — enable a profile that mounts agents to receive alarms in a DSH session',
    )
    return
  }

  if (sticky?.agent && typeof sticky.agent.followup === 'function') {
    try {
      await followup(ctx, sticky.agent, prompt)
      return
    } catch (error) {
      ctx.logger.warn('netxops alarm-push: sticky followup failed, recreating session: %s', error)
      sticky = null
    }
  }

  await createStickySession(ctx, prompt)
}

async function followup(ctx: Context, agent: { followup: (msg: unknown) => unknown }, prompt: string): Promise<void> {
  let createUserMessage: ((input: {
    content: Array<{ type: 'text'; text: string }>
    source?: Record<string, unknown>
  }) => unknown) | undefined
  try {
    const mod = await import('@deepseek-ai/dsh-llm') as {
      createUserMessage?: typeof createUserMessage
      boundContextSummary?: (text: string) => unknown
    }
    createUserMessage = mod.createUserMessage
    if (typeof createUserMessage !== 'function') throw new Error('createUserMessage missing')
    const summary = typeof mod.boundContextSummary === 'function'
      ? mod.boundContextSummary('netx key alarm')
      : 'netx key alarm'
    agent.followup(createUserMessage({
      content: [{ type: 'text', text: prompt }],
      source: {
        kind: 'webhook',
        provider: 'netx',
        source: 'dsh-alarm-hub',
        form: 'notice',
        summary,
      },
    }))
  } catch (error) {
    // Fallback: some hosts accept a plain text followup helper on agents.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyAgent = agent as any
    if (typeof anyAgent.prompt === 'function') {
      await anyAgent.prompt(prompt)
      return
    }
    ctx.logger.warn('netxops alarm-push: cannot build user message (%s)', error)
    throw error
  }
}

async function createStickySession(ctx: Context, prompt: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = ctx as any
  const agents = c.agents
  const agentPresets = c.agentPresets
  const workspaceRegistry = c.workspaceRegistry
  const permissionPresets = c.permissionPresets
  const sessionTitle = c.sessionTitle
  const agentDefaultModel = c.agentDefaultModel

  if (!agentPresets || typeof agentPresets.resolve !== 'function'
    || !workspaceRegistry || typeof workspaceRegistry.create !== 'function') {
    ctx.logger.warn(
      'netxops alarm-push: agentPresets/workspaceRegistry unavailable — cannot create a DSH session',
    )
    return
  }

  if (permissionPresets && typeof permissionPresets.resolve === 'function') {
    try {
      permissionPresets.resolve(PERMISSION_PRESET)
    } catch {
      ctx.logger.warn('netxops alarm-push: permission preset %s missing', PERMISSION_PRESET)
    }
  }

  const preset = await agentPresets.resolve(PRESET_ID)
  if (typeof agentPresets.standingKeyFor === 'function') {
    await agentPresets.standingKeyFor(preset.id)
  }

  const selected = typeof agentDefaultModel?.currentSelection === 'function'
    ? agentDefaultModel.currentSelection()
    : { provider: 'deepseek', model: 'deepseek-chat' }

  const workspacePath = resolveWorkspacePath()
  const workspace = await workspaceRegistry.create(workspacePath)
  const sessionId = `netxops-alarm-${Date.now().toString(36)}`

  const handle = await agents.create({
    sessionId,
    meta: { cwd: workspace.path, agentPreset: preset.id },
    agentOptions: { provider: selected.provider, model: selected.model },
    setup: async (agentCtx: Context) => {
      if (typeof agentPresets.mount === 'function') {
        await agentPresets.mount(agentCtx, preset.id)
      }
    },
  })

  try {
    if (typeof workspace.attachSession === 'function') {
      await workspace.attachSession(sessionId)
    }
    if (permissionPresets && typeof permissionPresets.set === 'function') {
      permissionPresets.set(handle.agent.session, PERMISSION_PRESET)
    }
    if (sessionTitle && typeof sessionTitle.rename === 'function') {
      sessionTitle.rename(handle.agent.session, TITLE)
    }
    await followup(ctx, handle.agent, prompt)
    sticky = { sessionId, agent: handle.agent }
    ctx.logger.info('netxops alarm-push: opened sticky session %s', sessionId)
  } catch (error) {
    try {
      await handle.dispose?.()
    } catch {
      // ignore
    }
    throw error
  }
}

/** Drop the sticky handle (tests / dispose). */
export function resetAlarmSession(): void {
  sticky = null
}
