/** Publish selected capabilities into live session scopes without rewriting presets. */
import type { Context } from '@deepseek-ai/cordis'
import { createScope, scopeOf, type Scope } from '@deepseek-ai/dsh-scope'
import { groupsForPreset, kbEnabledForPlane } from './capability-groups.ts'
import { applyGroupToolsPlugin } from './group-tools-plugin.ts'
import { getNetxConnection, watchNetxConnection } from './runtime.ts'
declare module '@deepseek-ai/cordis' {
  interface Events {
    'agent-preset/selected': (sessionId: string, presetId: string) => void
  }
}

interface LiveAgent { id: string; ctx: Context }
interface PresetRoster {
  composedPreset(ctx: Context): string | undefined
  list(): Promise<Array<{ id: string; name?: string; broken?: string }>>
}

/** Attach selected groups to existing and newly created sessions on either Host. */
export function installPresetPublication(ctx: Context): void {
  ctx.inject(['agents', 'agentPresets', 'tools'], child => {
    const agents = child.get('agents') as { list(): LiveAgent[] }
    const presets = child.get('agentPresets') as PresetRoster
    const mounts = new Map<string, { presetId: string; scope: Scope }>()
    let active = true
    const release = (id: string): void => {
      const mount = mounts.get(id)
      if (!mount) return
      mounts.delete(id)
      mount.scope.rawDispose()
    }
    const sync = (agent: LiveAgent): void => {
      if (!active) return
      const presetId = presets.composedPreset(agent.ctx)
      const connection = getNetxConnection()
      // Netx Ops owns its standing aggregate mount. Other targets use live scopes.
      const enabled = connection && presetId && presetId !== 'netxops'
        && (groupsForPreset(connection, presetId).length > 0
          || kbEnabledForPlane(connection, 'preset', presetId))
      const previous = mounts.get(agent.id)
      if (!enabled || previous?.presetId !== presetId) release(agent.id)
      if (!enabled || mounts.has(agent.id)) return
      const key = scopeOf(agent.ctx)
      if (!key) {
        child.logger.warn('netxops: selected preset %s has no session scope', presetId)
        return
      }
      // Register on the exact live scope; a sibling scope would be invisible to the agent.
      const scope = createScope(child, key)
      mounts.set(agent.id, { presetId, scope })
      applyGroupToolsPlugin(scope.ctx, { name: `netxops-selected:${presetId}:${agent.id}`, mode: 'settings', presetId })
    }
    const syncAll = (): void => { for (const agent of agents.list()) sync(agent) }
    child.on('agent/created', ({ agent }: { agent: LiveAgent }) => { sync(agent) })
    child.on('agent/disposed', ({ agent }: { agent: LiveAgent }) => { release(agent.id) })
    child.on('agent-preset/selected', () => { syncAll() })
    const stop = watchNetxConnection(syncAll)
    syncAll()
    child.effect(() => () => {
      active = false
      stop()
      for (const id of [...mounts.keys()]) release(id)
    }, 'netxops: selected preset publication')
  })
}
