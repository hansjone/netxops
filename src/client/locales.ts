/** Locale keys for the Netx Ops Plugins settings card. */

export type NetxopsLocaleKey =
  | 'title'
  | 'description'
  | 'apiUrl'
  | 'apiUrlHint'
  | 'lang'
  | 'langHint'
  | 'pythonCommand'
  | 'pythonCommandHint'
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
  description: 'UME API endpoint and bearer token for mcp__netx__* tools.',
  apiUrl: 'API URL',
  apiUrlHint: 'netx REST root, e.g. http://127.0.0.1:8890',
  lang: 'Language',
  langHint: 'Passed as NETX_LANG (zh / en).',
  pythonCommand: 'Python command',
  pythonCommandHint: 'Executable that can run `python -m netx_mcp`.',
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
  description: 'UME API 地址与 Bearer Token，供 mcp__netx__* 工具使用。',
  apiUrl: 'API 地址',
  apiUrlHint: 'netx REST 根地址，例如 http://127.0.0.1:8890',
  lang: '语言',
  langHint: '传给 MCP 的 NETX_LANG（zh / en）。',
  pythonCommand: 'Python 命令',
  pythonCommandHint: '能执行 `python -m netx_mcp` 的解释器。',
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
