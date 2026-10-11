import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_API_URL,
  DEFAULT_LANG,
  DEFAULT_TOKEN_REF,
  DEFAULT_TOOL_CALL_TIMEOUT_MS,
  mergeConfigSkippingNullish,
  resolveApiUrlForConnection,
  resolveLang,
  resolveTokenCredentialRef,
  resolveToolCallTimeoutMs,
} from '../src/index.ts'

const base = {
  apiUrl: 'http://127.0.0.1:8890',
  lang: 'zh',
  thinkingLanguage: 'auto',
  replyLanguage: 'follow-user',
  tokenCredentialRef: 'NETX_API_TOKEN',
  toolCallTimeoutMs: 120_000,
  installAgentPreset: true,
  alarmPushEnabled: false,
  alarmDeliverDsh: true,
  alarmDeliverIm: false,
  imTargets: '',
  imBotId: '',
  imTargetId: '',
  nmsProvider: 'zte-ume',
  groupOpsInPreset: true,
  groupOpsPublic: false,
  groupTopologyInPreset: false,
  groupTopologyPublic: false,
  groupBizMonitorInPreset: true,
  groupBizMonitorPublic: false,
  kbRoot: '',
  groupKbInPreset: true,
  groupKbPublic: false,
}

test('mergeConfigSkippingNullish ignores null/undefined volatile fields', () => {
  const merged = mergeConfigSkippingNullish(base, {
    apiUrl: null,
    toolCallTimeoutMs: null,
    lang: 'en',
    groupOpsPublic: undefined,
  })
  assert.equal(merged.apiUrl, 'http://127.0.0.1:8890')
  assert.equal(merged.toolCallTimeoutMs, 120_000)
  assert.equal(merged.lang, 'en')
  assert.equal(merged.groupOpsPublic, false)
})

test('resolveToolCallTimeoutMs rejects null / NaN / non-positive', () => {
  assert.equal(resolveToolCallTimeoutMs(null), DEFAULT_TOOL_CALL_TIMEOUT_MS)
  assert.equal(resolveToolCallTimeoutMs(undefined), DEFAULT_TOOL_CALL_TIMEOUT_MS)
  assert.equal(resolveToolCallTimeoutMs(Number.NaN), DEFAULT_TOOL_CALL_TIMEOUT_MS)
  assert.equal(resolveToolCallTimeoutMs(0), DEFAULT_TOOL_CALL_TIMEOUT_MS)
  assert.equal(resolveToolCallTimeoutMs(-1), DEFAULT_TOOL_CALL_TIMEOUT_MS)
  assert.equal(resolveToolCallTimeoutMs(90_000), 90_000)
})

test('resolveApiUrlForConnection falls back on null/empty; rejects bad schemes', () => {
  assert.deepEqual(resolveApiUrlForConnection(null), {
    url: DEFAULT_API_URL,
    usedDefault: true,
  })
  assert.deepEqual(resolveApiUrlForConnection(''), {
    url: DEFAULT_API_URL,
    usedDefault: true,
  })
  assert.deepEqual(resolveApiUrlForConnection('http://10.0.0.1:8890/'), {
    url: 'http://10.0.0.1:8890',
    usedDefault: false,
  })
  assert.equal(resolveApiUrlForConnection('file:///tmp').url, '')
  assert.equal(resolveApiUrlForConnection('file:///tmp').error, 'unsupported_scheme')
})

test('resolveTokenCredentialRef heals null/invalid to NETX_API_TOKEN', () => {
  assert.equal(resolveTokenCredentialRef(null), DEFAULT_TOKEN_REF)
  assert.equal(resolveTokenCredentialRef(''), DEFAULT_TOKEN_REF)
  assert.equal(resolveTokenCredentialRef('bad-name'), DEFAULT_TOKEN_REF)
  assert.equal(resolveTokenCredentialRef('NETX_API_TOKEN'), 'NETX_API_TOKEN')
  assert.equal(resolveTokenCredentialRef('CUSTOM_TOKEN'), 'CUSTOM_TOKEN')
})

test('resolveLang heals null/empty to zh', () => {
  assert.equal(resolveLang(null), DEFAULT_LANG)
  assert.equal(resolveLang(undefined), DEFAULT_LANG)
  assert.equal(resolveLang(''), DEFAULT_LANG)
  assert.equal(resolveLang('en'), 'en')
})
