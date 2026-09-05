/** Locale keys for the Netx Ops Plugins settings card. */

export type NetxopsLocaleKey =
  | 'title'
  | 'description'
  | 'apiUrl'
  | 'apiUrlHint'
  | 'lang'
  | 'langHint'
  | 'alarmPushEnabled'
  | 'alarmPushEnabledHint'
  | 'alarmPushStatus'
  | 'alarmPushPhaseDisabled'
  | 'alarmPushPhaseIdle'
  | 'alarmPushPhaseConnecting'
  | 'alarmPushPhaseAuthenticating'
  | 'alarmPushPhaseConnected'
  | 'alarmPushPhaseReconnecting'
  | 'alarmPushPhaseAuthFailed'
  | 'alarmPushPhaseError'
  | 'apiToken'
  | 'apiTokenHint'
  | 'apiTokenUnavailable'
  | 'apiTokenSet'
  | 'apiTokenUnset'
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
  description: 'UME API endpoint and bearer token for netx__* tools.',
  apiUrl: 'API URL',
  apiUrlHint: 'netx REST root, e.g. http://127.0.0.1:8890 (also used for alarm subscribe)',
  lang: 'Language',
  langHint: 'Response language hint (zh / en).',
  alarmPushEnabled: 'Key-alarm push',
  alarmPushEnabledHint: 'Dial out to netx and open/follow a DSH session when a matched key alarm arrives. WhatsApp/im is optional and not required.',
  alarmPushStatus: 'Push link',
  alarmPushPhaseDisabled: 'Off',
  alarmPushPhaseIdle: 'Idle',
  alarmPushPhaseConnecting: 'Connecting…',
  alarmPushPhaseAuthenticating: 'Authenticating…',
  alarmPushPhaseConnected: 'Connected',
  alarmPushPhaseReconnecting: 'Reconnecting…',
  alarmPushPhaseAuthFailed: 'Auth failed',
  alarmPushPhaseError: 'Error',
  apiToken: 'API token',
  apiTokenHint: 'Stored as credential NETX_API_TOKEN (never written into settings). Leave blank to keep the current token.',
  apiTokenUnavailable: 'This DSH build does not expose remote.credentials. Set the token with scripts/set-netx-token.ps1 (or .sh), then restart is not required if credentials are watched.',
  apiTokenSet: 'Configured',
  apiTokenUnset: 'Not set',
  overridden: 'Overridden',
  reset: 'Reset',
  invalid: 'Invalid value',
  expand: 'Expand',
  collapse: 'Collapse',
  unsaved: 'Unsaved',
  readOnly: 'This document is read-only.',
  saveFailed: 'Save failed — drafts kept for correction.',
  discard: 'Discard',
  save: 'Save',
  saving: 'Saving…',
}

export const zh: Record<NetxopsLocaleKey, string> = {
  title: 'Netx Ops',
  description: 'UME API 地址与 Bearer Token，供 netx__* 工具使用。',
  apiUrl: 'API 地址',
  apiUrlHint: 'netx REST 根地址，例如 http://127.0.0.1:8890（告警订阅复用同一地址）',
  lang: '语言',
  langHint: '响应语言提示（zh / en）。',
  alarmPushEnabled: '关键告警推送',
  alarmPushEnabledHint: '主动连接 netx；匹配到关键告警后在本机打开/续写一条 DSH 会话。不必安装 WhatsApp / im。',
  alarmPushStatus: '推送链路',
  alarmPushPhaseDisabled: '未开启',
  alarmPushPhaseIdle: '空闲',
  alarmPushPhaseConnecting: '连接中…',
  alarmPushPhaseAuthenticating: '鉴权中…',
  alarmPushPhaseConnected: '已连接',
  alarmPushPhaseReconnecting: '重连中…',
  alarmPushPhaseAuthFailed: '鉴权失败',
  alarmPushPhaseError: '异常',
  apiToken: 'API Token',
  apiTokenHint: '写入凭据 NETX_API_TOKEN（不会进 settings）。留空表示保留已有 token。',
  apiTokenUnavailable: '当前 DSH 未提供 remote.credentials。请用 scripts/set-netx-token.ps1（或 .sh）写入 token；若 harness 在监视凭据文件则无需重启。',
  apiTokenSet: '已配置',
  apiTokenUnset: '未设置',
  overridden: '已覆盖',
  reset: '重置',
  invalid: '无效值',
  expand: '展开',
  collapse: '收起',
  unsaved: '未保存',
  readOnly: '当前文档只读。',
  saveFailed: '保存失败，草稿已保留以便修改。',
  discard: '丢弃',
  save: '保存',
  saving: '保存中…',
}
