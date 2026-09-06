/** Locale keys for the Netx Ops Plugins settings card. */

export type NetxopsLocaleKey =
  | 'title'
  | 'description'
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
  | 'sessionsExportButton'
  | 'sessionsExportBusy'
  | 'sessionsExportDone'
  | 'overridden'
  | 'reset'
  | 'invalid'
  | 'expand'
  | 'collapse'
  | 'unsaved'
  | 'readOnly'
  | 'saveFailed'
  | 'discard'
  | 'save'
  | 'saving'

export const en: Record<NetxopsLocaleKey, string> = {
  title: 'Netx Ops',
  description: 'API, token, capabilities, and alarm delivery.',
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
  sessionsExportButton: 'Download ZIP',
  sessionsExportBusy: 'Preparing…',
  sessionsExportDone: 'Downloaded: {file}',
  overridden: 'Overridden',
  reset: 'Reset',
  invalid: 'Invalid',
  expand: 'Expand',
  collapse: 'Collapse',
  unsaved: 'Unsaved',
  readOnly: 'Read-only',
  saveFailed: 'Save failed',
  discard: 'Discard',
  save: 'Save',
  saving: 'Saving…',
}

export const zh: Record<NetxopsLocaleKey, string> = {
  title: 'Netx Ops',
  description: 'API、Token、能力组与告警投递。',
  apiUrl: 'API 地址',
  apiUrlHint: '例如 http://127.0.0.1:8890',
  lang: '语言',
  langHint: 'zh / en',
  capabilityGroups: '能力组',
  nmsProvider: 'NMS provider',
  nmsProviderHint: 'zte-ume',
  groupOps: 'ops',
  groupTopology: 'topology',
  groupInPreset: '在 Netx Ops 预设中启用',
  groupPublic: '对其他预设公开',
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
  sessionsExportButton: '下载 ZIP',
  sessionsExportBusy: '准备中…',
  sessionsExportDone: '已下载：{file}',
  overridden: '已覆盖',
  reset: '重置',
  invalid: '无效',
  expand: '展开',
  collapse: '收起',
  unsaved: '未保存',
  readOnly: '只读',
  saveFailed: '保存失败',
  discard: '丢弃',
  save: '保存',
  saving: '保存中…',
}
