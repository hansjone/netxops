/** Locale keys for the Netx Ops Plugins settings card. */

export type NetxopsLocaleKey =
  | 'title'
  | 'description'
  | 'apiUrl'
  | 'apiUrlHint'
  | 'lang'
  | 'langHint'
  | 'capabilityGroups'
  | 'capabilityGroupsHint'
  | 'nmsProvider'
  | 'nmsProviderHint'
  | 'groupOps'
  | 'groupTopology'
  | 'groupInPreset'
  | 'groupPublic'
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
  | 'imTarget'
  | 'imTargetNone'
  | 'imTargetManual'
  | 'imCatalogUnavailable'
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
  description: 'netx API, bearer token, and capability groups (ops / topology).',
  apiUrl: 'API URL',
  apiUrlHint: 'netx REST root, e.g. http://127.0.0.1:8890 (also used for alarm subscribe)',
  lang: 'Language',
  langHint: 'Response language hint (zh / en).',
  capabilityGroups: 'Capability groups',
  capabilityGroupsHint: 'One group ↔ one skill. ops = netx-ops (alarms + CLI login + paths); topology = netx-topology. Defaults: ops on; topology and public off. New sessions after save. Other agents: dsh-netxops/tools-ops|topology.',
  nmsProvider: 'nms provider',
  nmsProviderHint: 'Vendor adapter id. Supported today: zte-ume (REST still /v1/ume/*; model tools are netx__*Nms*).',
  groupOps: 'ops — skill netx-ops (NMS alarms/inventory + managed CLI login + paths)',
  groupTopology: 'topology — skill netx-topology (canvas / fabric / dual_unit)',
  groupInPreset: 'In Netx Ops preset',
  groupPublic: 'Publish to other presets',
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
  alarmDeliverImHint: 'Requires dsh-im-ops ≥ops.24. Pick a saved delivery target below (create targets under IM → Delivery settings).',
  imBotId: 'IM Bot ID',
  imBotIdHint: 'Filled from the picker, or enter manually.',
  imTargetId: 'IM Target ID',
  imTargetIdHint: 'Filled from the picker, or enter manually.',
  imTarget: 'Delivery target',
  imTargetNone: '(Create a target in IM delivery settings first)',
  imTargetManual: 'Enter manually…',
  imCatalogUnavailable: 'Cannot load targets — install/update dsh-im-ops (≥ops.24) and save at least one delivery target.',
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
  description: 'netx API、Bearer Token，以及能力组（ops / topology）。',
  apiUrl: 'API 地址',
  apiUrlHint: 'netx REST 根地址，例如 http://127.0.0.1:8890（告警订阅复用同一地址）',
  lang: '语言',
  langHint: '响应语言提示（zh / en）。',
  capabilityGroups: '能力组',
  capabilityGroupsHint: '一组一个 skill。ops = netx-ops（告警 + 纳管登录 + 路径）；topology = netx-topology。默认 ops 开；topology / 公开关。保存后新会话生效。其他 Agent：dsh-netxops/tools-ops|topology。',
  nmsProvider: 'nms provider',
  nmsProviderHint: '厂商适配器 id。当前支持：zte-ume（REST 仍为 /v1/ume/*；模型工具名为 netx__*Nms*）。',
  groupOps: 'ops — skill netx-ops（NMS 告警/库存 + 纳管 CLI 登录 + 路径）',
  groupTopology: 'topology — skill netx-topology（画布 / Fabric / dual_unit）',
  groupInPreset: '在 Netx Ops 预设中启用',
  groupPublic: '对其他预设公开',
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
  alarmDeliverImHint: '需要 dsh-im-ops ≥ops.24。请在下方下拉选择已保存的投递目标（先在 IM「投递设置」新建）。',
  imBotId: 'IM Bot ID',
  imBotIdHint: '由下拉自动填入，也可手动改。',
  imTargetId: 'IM Target ID',
  imTargetIdHint: '由下拉自动填入，也可手动改。',
  imTarget: '投递目标',
  imTargetNone: '（请先在 IM「投递设置」新建目标）',
  imTargetManual: '手动填写…',
  imCatalogUnavailable: '无法加载投递目标 — 请安装/更新 dsh-im-ops（≥ops.24）并至少保存一个投递目标。',
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
