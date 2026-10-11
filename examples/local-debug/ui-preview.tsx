/** Exercise the real card and controller with an in-memory Host for visual QA. */
import { useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { NetxopsCard } from '../../src/client/NetxopsCard.tsx'
import { NetxopsCardController } from '../../src/client/controller.ts'
import { zh, en } from '../../src/client/locales.ts'
import { unconfiguredKbSnapshot } from '../../src/netx/kb-manifest.ts'

const base = {
  apiUrl: 'http://127.0.0.1:8890', lang: 'zh', thinkingLanguage: 'auto', replyLanguage: 'follow-user',
  nmsProvider: 'zte-ume', tokenCredentialRef: 'NETX_API_TOKEN', toolsEnabled: true,
  groupOpsInPreset: true, groupOpsPublic: false, groupOpsPresets: '',
  groupTopologyInPreset: false, groupTopologyPublic: false, groupTopologyPresets: '',
  groupBizMonitorInPreset: true, groupBizMonitorPublic: false, groupBizMonitorPresets: '',
  kbRoot: '', groupKbInPreset: true, groupKbPublic: false, groupKbPresets: '',
  alarmPushEnabled: false, alarmDeliverDsh: true, alarmDeliverIm: false,
  imTargets: '', imBotId: '', imTargetId: '',
}
const user = {}, listeners = new Set<() => void>()
const scope = {
  getSnapshot: () => ({ status: 'ready', writable: true, value: { ...base, ...user }, base, user }),
  subscribe(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn) },
  async set(field: string, value: unknown) { user[field] = value; for (const fn of listeners) fn() },
  async unset(field: string) { delete user[field]; for (const fn of listeners) fn() },
}
const controller = new NetxopsCardController(scope, { get: () => undefined } as never)
controller.setAlarmPushRpc(async (_channel, endpoint) => {
  const value = scope.getSnapshot().value
  if (endpoint === 'presets.catalog') return { ok: true, value: { presets: [
    { id: 'netxops', name: 'Netx Ops' }, { id: 'standard', name: '标准助手' },
    { id: 'review', name: '代码审查' }, { id: 'network-analyst', name: '网络分析' },
  ] } }
  if (endpoint === 'tools.status') return { ok: true, value: {
    mounts: [{ source: 'Netx Ops', plane: 'preset', version: 'dev', groups: ['ops', 'bizMonitor'],
      names: value.toolsEnabled ? Array.from({ length: 23 }, (_, i) => `netx__preview${i}`) : [],
      count: value.toolsEnabled ? 23 : 0 }],
    connection: { toolsEnabled: value.toolsEnabled, apiUrl: value.apiUrl, tokenConfigured: false },
  } }
  if (endpoint === 'kb.status' || endpoint === 'kb.reload') return { ok: true, value: unconfiguredKbSnapshot() }
  if (endpoint === 'alarm-push.status') return { ok: true, value: { phase: 'disabled', enabled: false, wsUrl: '' } }
  if (endpoint === 'im-delivery.catalog') return { ok: true, value: { available: false, options: [] } }
  return { ok: true, value: { available: false, reasonCode: 'no_persistence', sessionCount: 0 } }
})
const face = controller.inject(), store = face.hooks.netxopsCard
const dictionary = new URLSearchParams(location.search).get('lang') === 'en' ? en : zh
function Preview() {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return <NetxopsCard {...face} t={key => dictionary[key]}
    useNetxopsCard={selector => selector(state)} {...({} as never)} />
}
createRoot(document.getElementById('root')!).render(<Preview />)
