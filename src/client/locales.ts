/** Locale keys for the Netx Ops settings section. */

export type NetxopsLocaleKey =
  | 'settingsUnavailable'
  | 'toolsEnabled'
  | 'toolsEnabledHint'
  | 'toolsDisabled'
  | 'selectedPresets'
  | 'publicationHint'
  | 'presetCatalogUnavailable'
  | 'presetUnavailable'
  | 'noOtherPresets'
  | 'mountStatusHint'
  | 'mountDetails'
  | 'title'
  | 'description'
  | 'sectionConnection'
  | 'sectionCapabilities'
  | 'sectionKnowledge'
  | 'sectionAlarms'
  | 'sectionExport'
  | 'apiUrl'
  | 'apiUrlHint'
  | 'apiUrlInvalid'
  | 'lang'
  | 'langHint'
  | 'thinkingLanguage'
  | 'thinkingLanguageHint'
  | 'replyLanguage'
  | 'replyLanguageHint'
  | 'capabilityGroups'
  | 'nmsProvider'
  | 'nmsProviderHint'
  | 'groupOps'
  | 'groupTopology'
  | 'groupBizMonitor'
  | 'groupKb'
  | 'groupInPreset'
  | 'groupPublic'
  | 'kbRoot'
  | 'kbRootHint'
  | 'kbBrowse'
  | 'kbBrowseUnavailable'
  | 'kbBrowseFailed'
  | 'kbSaveHint'
  | 'kbStatusConfigured'
  | 'kbStatusUnconfigured'
  | 'kbStatusError'
  | 'alarmPushEnabled'
  | 'alarmPushStatus'
  | 'alarmPushPhaseDisabled'
  | 'alarmPushPhaseIdle'
  | 'alarmPushPhaseConnecting'
  | 'alarmPushPhaseAuthenticating'
  | 'alarmPushPhaseConnected'
  | 'alarmPushPhaseReconnecting'
  | 'alarmPushPhaseAuthFailed'
  | 'alarmPushPhaseError'
  | 'alarmDeliverDsh'
  | 'alarmDeliverIm'
  | 'imTargetNone'
  | 'imTargetSelectedCount'
  | 'imCatalogUnavailable'
  | 'apiToken'
  | 'apiTokenHint'
  | 'apiTokenUnavailable'
  | 'apiTokenSet'
  | 'apiTokenUnset'
  | 'toolsStatus'
  | 'toolsStatusMounted'
  | 'toolsStatusEmpty'
  | 'toolsStatusError'
  | 'toolsStatusUnknown'
  | 'sessionsExport'
  | 'sessionsExportCount'
  | 'sessionsExportUnavailable'
  | 'sessionsExportNoPersistence'
  | 'sessionsExportNoRawArtifacts'
  | 'sessionsExportListFailed'
  | 'sessionsExportRpcUnavailable'
  | 'sessionsExportRpcFailed'
  | 'sessionsExportHttpFailed'
  | 'sessionsExportEmpty'
  | 'sessionsExportButton'
  | 'sessionsExportBusy'
  | 'sessionsExportDone'
  | 'overridden'
  | 'reset'
  | 'invalid'
  | 'unsaved'
  | 'readOnly'
  | 'saveFailed'
  | 'discard'
  | 'save'
  | 'saving'
  | 'configSaved'

export const en: Record<NetxopsLocaleKey, string> = {
  settingsUnavailable: 'Waiting for Host settings. Saving is disabled until connected. If this persists, check that the Host plugin is enabled.',
  toolsEnabled: 'Publish Netx capabilities',
  toolsEnabledHint: 'Auto-saves. Turn off to withdraw all Netx tools and skills; your group selections are retained.',
  toolsDisabled: 'All Netx tools and skills are off',
  selectedPresets: 'Selected other presets',
  publicationHint: 'Tools and their skills are published together. Changes auto-save and apply to the next model request in current and new sessions. Public capabilities are inherited by every preset, including Netx Ops.',
  presetCatalogUnavailable: 'Preset roster unavailable. Existing selections are retained and can be removed.',
  presetUnavailable: 'Preset unavailable',
  noOtherPresets: 'No other presets available on this Host.',
  mountStatusHint: 'Actual mounts on this Host. Selected other presets mount when a session is active. This is registration status; API access is checked during tool calls.',
  mountDetails: 'Mount details',
  title: 'Netx Ops',
  description: 'API, token, capabilities, knowledge base, and alarm delivery.',
  sectionConnection: 'Connection',
  sectionCapabilities: 'Capability groups',
  sectionKnowledge: 'Knowledge base',
  sectionAlarms: 'Key-alarm delivery',
  sectionExport: 'Session export',
  apiUrl: 'API URL',
  apiUrlHint: 'e.g. http://127.0.0.1:8890',
  apiUrlInvalid: 'Must be http(s) without username/password (no file:/javascript:)',
  lang: 'API / alarm language',
  langHint: 'zh / en — netx API query + alarm prompt copy only (not model reply)',
  thinkingLanguage: 'Thinking language',
  thinkingLanguageHint: 'auto / zh-CN / en — model chain-of-thought for all presets',
  replyLanguage: 'Reply language',
  replyLanguageHint: 'follow-user / zh / en — final answers for all presets',
  capabilityGroups: 'Capability groups',
  nmsProvider: 'NMS provider',
  nmsProviderHint: 'zte-ume',
  groupOps: 'Alarms, inventory and CLI',
  groupTopology: 'Topology and layout',
  groupBizMonitor: 'Cutover monitoring',
  groupKb: 'Knowledge skills',
  groupInPreset: 'In Netx Ops preset (auto-saves; mount/unmount immediately)',
  groupPublic: 'Publish to every preset (auto-saves)',
  kbRoot: 'Package root',
  kbRootHint: 'Folder with MANIFEST.json (operator-subset v1.0). Browse auto-saves. Pack skills load from paths.skills/_skills and paths.localSkills when hasSkills.',
  kbBrowse: 'Browse…',
  kbBrowseUnavailable: 'Directory picker unavailable — paste an absolute folder path, then Save.',
  kbBrowseFailed: 'Browse failed: {detail}',
  kbSaveHint: 'Browse writes and saves automatically, then reloads Host KB status. Manual paste still needs Save.',
  kbStatusConfigured: 'Knowledge base: {operator} ({country}) v{version}',
  kbStatusUnconfigured: 'Knowledge base: not configured (pure netx)',
  kbStatusError: 'Knowledge base: error — {detail}',
  alarmPushEnabled: 'Key-alarm push',
  alarmPushStatus: 'Status',
  alarmPushPhaseDisabled: 'Off',
  alarmPushPhaseIdle: 'Idle',
  alarmPushPhaseConnecting: 'Connecting…',
  alarmPushPhaseAuthenticating: 'Authenticating…',
  alarmPushPhaseConnected: 'Connected',
  alarmPushPhaseReconnecting: 'Reconnecting…',
  alarmPushPhaseAuthFailed: 'Auth failed',
  alarmPushPhaseError: 'Error',
  alarmDeliverDsh: 'Deliver to DSH session',
  alarmDeliverIm: 'Deliver to WhatsApp / IM',
  imTargetNone: 'No delivery targets yet — create one in IM delivery settings.',
  imTargetSelectedCount: '{count} selected',
  imCatalogUnavailable: 'Cannot load IM targets (install/update dsh-im-ops).',
  apiToken: 'API token',
  apiTokenHint: 'Stored as NETX_API_TOKEN. Leave blank to keep current.',
  apiTokenUnavailable: 'remote.credentials unavailable — set NETX_API_TOKEN via script.',
  apiTokenSet: 'Configured',
  apiTokenUnset: 'Not set',
  toolsStatus: 'Agent tools',
  toolsStatusMounted: '{count} netx__* tools (v{version})',
  toolsStatusEmpty: 'No active Netx tool mounts',
  toolsStatusError: 'Tool mount failed: {detail}',
  toolsStatusUnknown: 'Host status unavailable',
  sessionsExport: 'Export all sessions',
  sessionsExportCount: '{count} sessions',
  sessionsExportUnavailable: 'Export unavailable',
  sessionsExportNoPersistence: 'Session store unavailable (JSONL backend required).',
  sessionsExportNoRawArtifacts: 'This persistence backend cannot export raw session files.',
  sessionsExportListFailed: 'Failed to list sessions: {detail}',
  sessionsExportRpcUnavailable: 'Cannot reach Host RPC for export status.',
  sessionsExportRpcFailed: 'Export status RPC failed.',
  sessionsExportHttpFailed: 'Export failed: HTTP {status}{detail}',
  sessionsExportEmpty: 'Export failed: empty ZIP body.',
  sessionsExportButton: 'Download ZIP',
  sessionsExportBusy: 'Preparing…',
  sessionsExportDone: 'Downloaded: {file}',
  overridden: 'Overridden',
  reset: 'Reset',
  invalid: 'Invalid',
  unsaved: 'Unsaved changes',
  readOnly: 'Read-only',
  saveFailed: 'Save failed',
  discard: 'Discard',
  save: 'Save',
  saving: 'Saving…',
  configSaved: 'Saved',
}

export const zh: Record<NetxopsLocaleKey, string> = {
  settingsUnavailable: '正在等待 Host 设置，连接就绪前不能保存。若持续等待，请检查 Host 插件是否启用。',
  toolsEnabled: '启用 Netx 能力发布',
  toolsEnabledHint: '自动保存。关闭会撤销全部 Netx 工具和 skill，保留各组选择，便于随时恢复。',
  toolsDisabled: '全部 Netx 工具和 skill 已关闭',
  selectedPresets: '指定其他预设',
  publicationHint: '工具与对应 skill 一起发布。选择自动保存，对当前及新会话的下一次模型请求生效。公开能力由所有预设继承，也包括 Netx Ops。',
  presetCatalogUnavailable: '暂时无法读取预设列表，已有选择会保留，也可以取消。',
  presetUnavailable: '预设不可用',
  noOtherPresets: '此 Host 暂无其他预设。',
  mountStatusHint: '显示此 Host 的实际挂载。指定其他预设在会话活跃时挂载；此状态表示注册结果，API 权限在调用工具时验证。',
  mountDetails: '查看实际挂载明细',
  title: 'Netx Ops',
  description: 'API、Token、能力组、知识库与告警投递。',
  sectionConnection: '连接',
  sectionCapabilities: '能力组',
  sectionKnowledge: '知识库',
  sectionAlarms: '关键告警投递',
  sectionExport: '会话导出',
  apiUrl: 'API 地址',
  apiUrlHint: '例如 http://127.0.0.1:8890',
  apiUrlInvalid: '须为无账号密码的 http(s) 地址（不支持 file:/javascript:）',
  lang: 'API / 告警语言',
  langHint: 'zh / en — 仅影响 netx API 与告警文案，不控制模型回复',
  thinkingLanguage: '思考语言',
  thinkingLanguageHint: 'auto / zh-CN / en — 全预设模型思考过程语言',
  replyLanguage: '回复语言',
  replyLanguageHint: 'follow-user / zh / en — 全预设最终回答语言',
  capabilityGroups: '能力组',
  nmsProvider: 'NMS 提供方',
  nmsProviderHint: 'zte-ume',
  groupOps: '告警、资产与 CLI 运维',
  groupTopology: '拓扑与布局',
  groupBizMonitor: '割接业务监控',
  groupKb: '知识库技能',
  groupInPreset: '在 Netx Ops 预设中启用（自动保存，即时挂载/卸载）',
  groupPublic: '对所有预设公开（自动保存）',
  kbRoot: '知识包根目录',
  kbRootHint: '含 MANIFEST.json 的运营商子集包（v1.0）。浏览选目录后会自动保存；hasSkills 时加载 paths.skills/_skills 与 paths.localSkills。',
  kbBrowse: '浏览…',
  kbBrowseUnavailable: '目录选择器不可用 — 请粘贴绝对目录路径后点保存。',
  kbBrowseFailed: '浏览失败：{detail}',
  kbSaveHint: '点「浏览」选目录后会自动写入、保存，并刷新宿主知识库状态；若是手粘路径仍需点保存。',
  kbStatusConfigured: '知识库: {operator}（{country}） v{version}',
  kbStatusUnconfigured: '知识库: 未配置（纯 netx）',
  kbStatusError: '知识库: 错误 — {detail}',
  alarmPushEnabled: '关键告警推送',
  alarmPushStatus: '状态',
  alarmPushPhaseDisabled: '未开启',
  alarmPushPhaseIdle: '空闲',
  alarmPushPhaseConnecting: '连接中…',
  alarmPushPhaseAuthenticating: '鉴权中…',
  alarmPushPhaseConnected: '已连接',
  alarmPushPhaseReconnecting: '重连中…',
  alarmPushPhaseAuthFailed: '鉴权失败',
  alarmPushPhaseError: '异常',
  alarmDeliverDsh: '投递到 DSH 会话',
  alarmDeliverIm: '投递到 WhatsApp / IM',
  imTargetNone: '暂无投递目标 — 请先在 IM「投递设置」新建。',
  imTargetSelectedCount: '已选 {count} 个',
  imCatalogUnavailable: '无法加载投递目标（请安装/更新 dsh-im-ops）。',
  apiToken: 'API Token',
  apiTokenHint: '写入凭据 NETX_API_TOKEN；留空表示保留已有。',
  apiTokenUnavailable: '未提供 remote.credentials — 请用脚本写入 NETX_API_TOKEN。',
  apiTokenSet: '已配置',
  apiTokenUnset: '未设置',
  toolsStatus: 'Agent 工具',
  toolsStatusMounted: '已挂载 {count} 个 netx__*（v{version}）',
  toolsStatusEmpty: '当前没有活跃的 Netx 工具挂载',
  toolsStatusError: '工具挂载失败：{detail}',
  toolsStatusUnknown: '无法读取 Host 状态',
  sessionsExport: '导出全部会话',
  sessionsExportCount: '{count} 个会话',
  sessionsExportUnavailable: '无法导出',
  sessionsExportNoPersistence: '会话持久化不可用（需要 JSONL 后端）。',
  sessionsExportNoRawArtifacts: '当前持久化后端不支持导出原始会话文件。',
  sessionsExportListFailed: '列出会话失败：{detail}',
  sessionsExportRpcUnavailable: '无法通过 Host RPC 查询导出状态。',
  sessionsExportRpcFailed: '导出状态 RPC 失败。',
  sessionsExportHttpFailed: '导出失败：HTTP {status}{detail}',
  sessionsExportEmpty: '导出失败：ZIP 为空。',
  sessionsExportButton: '下载 ZIP',
  sessionsExportBusy: '准备中…',
  sessionsExportDone: '已下载：{file}',
  overridden: '已覆盖',
  reset: '重置',
  invalid: '无效',
  unsaved: '有未保存更改',
  readOnly: '只读',
  saveFailed: '保存失败',
  discard: '丢弃',
  save: '保存',
  saving: '保存中…',
  configSaved: '已保存',
}
