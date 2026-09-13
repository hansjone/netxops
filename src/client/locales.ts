/** Locale keys for the Netx Ops settings section. */

export type NetxopsLocaleKey =
  | 'title'
  | 'description'
  | 'sectionConnection'
  | 'sectionCapabilities'
  | 'sectionKnowledge'
  | 'sectionAlarms'
  | 'sectionExport'
  | 'apiUrl'
  | 'apiUrlHint'
  | 'lang'
  | 'langHint'
  | 'capabilityGroups'
  | 'nmsProvider'
  | 'nmsProviderHint'
  | 'groupOps'
  | 'groupTopology'
  | 'groupInPreset'
  | 'groupPublic'
  | 'kbRoot'
  | 'kbRootHint'
  | 'kbBrowse'
  | 'kbBrowseUnavailable'
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
  title: 'Netx Ops',
  description: 'API, token, capabilities, knowledge base, and alarm delivery.',
  sectionConnection: 'Connection',
  sectionCapabilities: 'Capability groups',
  sectionKnowledge: 'Knowledge base',
  sectionAlarms: 'Key-alarm delivery',
  sectionExport: 'Session export',
  apiUrl: 'API URL',
  apiUrlHint: 'e.g. http://127.0.0.1:8890',
  lang: 'Language',
  langHint: 'zh / en',
  capabilityGroups: 'Capability groups',
  nmsProvider: 'NMS provider',
  nmsProviderHint: 'zte-ume',
  groupOps: 'ops',
  groupTopology: 'topology',
  groupInPreset: 'In Netx Ops preset',
  groupPublic: 'Publish to other presets',
  kbRoot: 'Package root',
  kbRootHint: 'Folder with MANIFEST.json (operator-subset v1.0). Empty = pure netx.',
  kbBrowse: 'Browse…',
  kbBrowseUnavailable: 'Directory picker unavailable — paste an absolute path.',
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
  title: 'Netx Ops',
  description: 'API、Token、能力组、知识库与告警投递。',
  sectionConnection: '连接',
  sectionCapabilities: '能力组',
  sectionKnowledge: '知识库',
  sectionAlarms: '关键告警投递',
  sectionExport: '会话导出',
  apiUrl: 'API 地址',
  apiUrlHint: '例如 http://127.0.0.1:8890',
  lang: '语言',
  langHint: 'zh / en',
  capabilityGroups: '能力组',
  nmsProvider: 'NMS 提供方',
  nmsProviderHint: 'zte-ume',
  groupOps: 'ops',
  groupTopology: 'topology',
  groupInPreset: '在 Netx Ops 预设中启用',
  groupPublic: '对其他预设公开',
  kbRoot: '知识包根目录',
  kbRootHint: '含 MANIFEST.json 的运营商子集包（v1.0）。留空=纯 netx。',
  kbBrowse: '浏览…',
  kbBrowseUnavailable: '目录选择器不可用 — 请粘贴绝对路径。',
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
