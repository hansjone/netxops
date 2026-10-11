/** Locale keys for the Netx Ops settings section. */

export type NetxopsLocaleKey =
  | 'settingsUnavailable'
  | 'toolsEnabled'
  | 'toolsDisabled'
  | 'selectedPresets'
  | 'presetCatalogUnavailable'
  | 'presetUnavailable'
  | 'noOtherPresets'
  | 'mountStatusHint'
  | 'mountDetails'
  | 'title'
  | 'sectionConnection'
  | 'sectionLanguage'
  | 'languageScope'
  | 'languageAuto'
  | 'languageFollowUser'
  | 'languageChinese'
  | 'languageEnglish'
  | 'sectionCapabilities'
  | 'sectionKnowledge'
  | 'sectionAlarms'
  | 'sectionExport'
  | 'apiUrl'
  | 'apiUrlHint'
  | 'apiUrlInvalid'
  | 'lang'
  | 'thinkingLanguage'
  | 'replyLanguage'
  | 'nmsProvider'
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
  | 'kbStatusConfigured'
  | 'kbStatusUnconfigured'
  | 'kbStatusError'
  | 'alarmPushEnabled'
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
  | 'toolsStatusMounted'
  | 'toolsStatusEmpty'
  | 'toolsStatusError'
  | 'toolsStatusUnknown'
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
  | 'reset'
  | 'invalid'
  | 'unsaved'
  | 'readOnly'
  | 'saveFailed'
  | 'discard'
  | 'save'
  | 'saving'

export const en: Record<NetxopsLocaleKey, string> = {
  settingsUnavailable: 'Connecting to Host settings…',
  toolsEnabled: 'Enable tools and skills',
  toolsDisabled: 'Disabled',
  selectedPresets: 'Other presets',
  presetCatalogUnavailable: 'Cannot load presets. Existing selections are retained.',
  presetUnavailable: 'Preset unavailable',
  noOtherPresets: 'No other presets available.',
  mountStatusHint: 'Registered tools in active sessions; API access is verified when a tool runs.',
  mountDetails: 'Diagnostics',
  title: 'Netx Ops',
  sectionConnection: 'Connection',
  sectionLanguage: 'Model language',
  languageScope: 'Applies to all presets',
  languageAuto: 'Automatic',
  languageFollowUser: 'Follow user',
  languageChinese: 'Chinese',
  languageEnglish: 'English',
  sectionCapabilities: 'Tools and skills',
  sectionKnowledge: 'Knowledge base',
  sectionAlarms: 'Key-alarm delivery',
  sectionExport: 'Session export',
  apiUrl: 'API URL',
  apiUrlHint: 'http://127.0.0.1:8890',
  apiUrlInvalid: 'Enter an HTTP or HTTPS URL without credentials.',
  lang: 'API / alarm language',
  thinkingLanguage: 'Thinking language',
  replyLanguage: 'Reply language',
  nmsProvider: 'NMS provider',
  groupOps: 'Alarms, inventory and CLI',
  groupTopology: 'Topology and layout',
  groupBizMonitor: 'Cutover monitoring',
  groupKb: 'Knowledge skills',
  groupInPreset: 'Netx Ops',
  groupPublic: 'All presets',
  kbRoot: 'Package root',
  kbRootHint: 'Absolute path to a folder containing MANIFEST.json',
  kbBrowse: 'Browse…',
  kbBrowseUnavailable: 'Enter the folder path manually.',
  kbBrowseFailed: 'Browse failed: {detail}',
  kbStatusConfigured: '{operator} ({country}) · v{version}',
  kbStatusUnconfigured: 'Not configured',
  kbStatusError: 'Load failed',
  alarmPushEnabled: 'Enable push',
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
  imTargetNone: 'No targets. Add one in IM settings.',
  imTargetSelectedCount: '{count} selected',
  imCatalogUnavailable: 'IM delivery unavailable',
  apiToken: 'API token',
  apiTokenHint: 'Leave blank to keep the current token',
  apiTokenUnavailable: 'Credential service unavailable',
  apiTokenSet: 'Configured',
  apiTokenUnset: 'Not set',
  toolsStatusMounted: '{count} active tools',
  toolsStatusEmpty: 'No active tools',
  toolsStatusError: 'Publication failed',
  toolsStatusUnknown: 'Status unavailable',
  sessionsExportCount: '{count} sessions',
  sessionsExportUnavailable: 'Export unavailable',
  sessionsExportNoPersistence: 'Session store unavailable.',
  sessionsExportNoRawArtifacts: 'This session store does not support export.',
  sessionsExportListFailed: 'Failed to list sessions: {detail}',
  sessionsExportRpcUnavailable: 'Export service unavailable.',
  sessionsExportRpcFailed: 'Cannot load export status.',
  sessionsExportHttpFailed: 'Export failed: HTTP {status}{detail}',
  sessionsExportEmpty: 'Export failed: empty ZIP body.',
  sessionsExportButton: 'Download ZIP',
  sessionsExportBusy: 'Preparing…',
  sessionsExportDone: 'Downloaded: {file}',
  reset: 'Reset',
  invalid: 'Invalid',
  unsaved: 'Unsaved changes',
  readOnly: 'Read-only',
  saveFailed: 'Save failed',
  discard: 'Discard',
  save: 'Save',
  saving: 'Saving…',
}

export const zh: Record<NetxopsLocaleKey, string> = {
  settingsUnavailable: '正在连接 Host 设置…',
  toolsEnabled: '启用工具与技能',
  toolsDisabled: '已关闭',
  selectedPresets: '其他预设',
  presetCatalogUnavailable: '无法加载预设列表，已有选择已保留。',
  presetUnavailable: '预设不可用',
  noOtherPresets: '暂无其他预设。',
  mountStatusHint: '当前活跃会话中的工具注册情况；API 权限在调用时验证。',
  mountDetails: '诊断信息',
  title: 'Netx Ops',
  sectionConnection: '连接',
  sectionLanguage: '模型语言',
  languageScope: '适用于所有预设',
  languageAuto: '自动',
  languageFollowUser: '跟随用户',
  languageChinese: '中文',
  languageEnglish: 'English',
  sectionCapabilities: '工具与技能',
  sectionKnowledge: '知识库',
  sectionAlarms: '关键告警投递',
  sectionExport: '会话导出',
  apiUrl: 'API 地址',
  apiUrlHint: 'http://127.0.0.1:8890',
  apiUrlInvalid: '请输入不含账号密码的 HTTP 或 HTTPS 地址。',
  lang: 'API / 告警语言',
  thinkingLanguage: '思考语言',
  replyLanguage: '回复语言',
  nmsProvider: 'NMS 提供方',
  groupOps: '告警、资产与 CLI 运维',
  groupTopology: '拓扑与布局',
  groupBizMonitor: '割接业务监控',
  groupKb: '知识库技能',
  groupInPreset: 'Netx Ops',
  groupPublic: '所有预设',
  kbRoot: '知识包根目录',
  kbRootHint: '含 MANIFEST.json 的知识包绝对路径',
  kbBrowse: '浏览…',
  kbBrowseUnavailable: '请手动输入目录路径。',
  kbBrowseFailed: '浏览失败：{detail}',
  kbStatusConfigured: '{operator}（{country}）· v{version}',
  kbStatusUnconfigured: '未配置',
  kbStatusError: '加载失败',
  alarmPushEnabled: '启用推送',
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
  imTargetNone: '暂无目标，请在 IM 设置中添加。',
  imTargetSelectedCount: '已选 {count} 个',
  imCatalogUnavailable: 'IM 投递不可用',
  apiToken: 'API Token',
  apiTokenHint: '留空保留当前凭据',
  apiTokenUnavailable: '凭据服务不可用',
  apiTokenSet: '已配置',
  apiTokenUnset: '未设置',
  toolsStatusMounted: '{count} 个工具',
  toolsStatusEmpty: '暂无活跃工具',
  toolsStatusError: '发布异常',
  toolsStatusUnknown: '状态不可用',
  sessionsExportCount: '{count} 个会话',
  sessionsExportUnavailable: '无法导出',
  sessionsExportNoPersistence: '会话存储不可用。',
  sessionsExportNoRawArtifacts: '当前会话存储不支持导出。',
  sessionsExportListFailed: '列出会话失败：{detail}',
  sessionsExportRpcUnavailable: '导出服务不可用。',
  sessionsExportRpcFailed: '无法获取导出状态。',
  sessionsExportHttpFailed: '导出失败：HTTP {status}{detail}',
  sessionsExportEmpty: '导出失败：ZIP 为空。',
  sessionsExportButton: '下载 ZIP',
  sessionsExportBusy: '准备中…',
  sessionsExportDone: '已下载：{file}',
  reset: '重置',
  invalid: '无效',
  unsaved: '有未保存更改',
  readOnly: '只读',
  saveFailed: '保存失败',
  discard: '丢弃',
  save: '保存',
  saving: '保存中…',
}
