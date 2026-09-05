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
  | 'alarmDeliverDsh'
  | 'alarmDeliverDshHint'
  | 'alarmDeliverIm'
  | 'alarmDeliverImHint'
  | 'imBotId'
  | 'imBotIdHint'
  | 'imTargetId'
  | 'imTargetIdHint'
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
  alarmPushEnabledHint: 'Dial out to netx when a matched key alarm arrives. Choose DSH and/or IM sinks below.',
  alarmPushStatus: 'Push link',
  alarmPushPhaseDisabled: 'Off',
  alarmPushPhaseIdle: 'Idle',
  alarmPushPhaseConnecting: 'Connecting…',
  alarmPushPhaseAuthenticating: 'Authenticating…',
  alarmPushPhaseConnected: 'Connected',
  alarmPushPhaseReconnecting: 'Reconnecting…',
  alarmPushPhaseAuthFailed: 'Auth failed',
  alarmPushPhaseError: 'Error',
  alarmDeliverDsh: 'Deliver to DSH session',
  alarmDeliverDshHint: 'Open/follow the sticky「Netx 关键告警」session on this Host.',
  alarmDeliverIm: 'Deliver to WhatsApp / IM',
  alarmDeliverImHint: 'Requires dsh-im-ops. Paste botId + targetId from IM → 投递设置 → 复制调用参数.',
  imBotId: 'IM Bot ID',
  imBotIdHint: 'Opaque botId from IM delivery settings (not a phone number).',
  imTargetId: 'IM Target ID',
  imTargetIdHint: 'Opaque targetId alias (e.g. release-alerts). Create the target in IM first.',
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
  alarmPushEnabledHint: '主动连接 netx；匹配到关键告警后按下述开关投递。可只开 DSH、只开 IM，或两者都开。',
  alarmPushStatus: '推送链路',
  alarmPushPhaseDisabled: '未开启',
  alarmPushPhaseIdle: '空闲',
  alarmPushPhaseConnecting: '连接中…',
  alarmPushPhaseAuthenticating: '鉴权中…',
  alarmPushPhaseConnected: '已连接',
  alarmPushPhaseReconnecting: '重连中…',
  alarmPushPhaseAuthFailed: '鉴权失败',
  alarmPushPhaseError: '异常',
  alarmDeliverDsh: '投递到 DSH 会话',
  alarmDeliverDshHint: '在本机打开/续写 sticky「Netx 关键告警」会话。',
  alarmDeliverIm: '投递到 WhatsApp / IM',
  alarmDeliverImHint: '需要已安装 dsh-im-ops。请先在 IM「投递设置」新建目标，再粘贴「复制调用参数」里的 botId / targetId。',
  imBotId: 'IM Bot ID',
  imBotIdHint: '来自 IM 投递设置的不透明 botId（不是手机号）。',
  imTargetId: 'IM Target ID',
  imTargetIdHint: '投递目标别名（如 release-alerts）。请先在 IM 侧创建目标。',
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
