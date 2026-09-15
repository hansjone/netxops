import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  languageFromLocale,
  normalizeReplyLanguage,
  normalizeThinkingLanguage,
  replyInstruction,
  replyReminder,
  resolveThinkingLanguage,
  thinkingInstruction,
  thinkingReminder,
} from '../src/netx/model-language.ts'

test('normalizeThinkingLanguage accepts aliases and defaults to auto', () => {
  assert.equal(normalizeThinkingLanguage(undefined), 'auto')
  assert.equal(normalizeThinkingLanguage('zh'), 'zh-CN')
  assert.equal(normalizeThinkingLanguage('zh-CN'), 'zh-CN')
  assert.equal(normalizeThinkingLanguage('en-US'), 'en')
  assert.equal(normalizeThinkingLanguage('nope'), 'auto')
})

test('normalizeReplyLanguage accepts aliases and defaults to follow-user', () => {
  assert.equal(normalizeReplyLanguage(undefined), 'follow-user')
  assert.equal(normalizeReplyLanguage('auto'), 'follow-user')
  assert.equal(normalizeReplyLanguage('zh-CN'), 'zh')
  assert.equal(normalizeReplyLanguage('english'), 'en')
})

test('resolveThinkingLanguage follows locale when auto', () => {
  assert.equal(resolveThinkingLanguage('auto', 'zh-CN'), 'zh-CN')
  assert.equal(resolveThinkingLanguage('auto', 'en-US'), 'en')
  assert.equal(resolveThinkingLanguage('en', 'zh-CN'), 'en')
  assert.equal(resolveThinkingLanguage('auto', 'de-DE'), 'en')
})

test('languageFromLocale covers chinese and english tags', () => {
  assert.equal(languageFromLocale('zh-Hans-CN'), 'zh-CN')
  assert.equal(languageFromLocale('en'), 'en')
  assert.equal(languageFromLocale(''), undefined)
})

test('thinkingInstruction and reminder mention the target language', () => {
  const instruction = thinkingInstruction('zh-CN')
  assert.match(instruction, /Simplified Chinese/)
  assert.match(thinkingReminder('en'), /English/)
})

test('replyInstruction is empty for follow-user and forces otherwise', () => {
  assert.equal(replyInstruction('follow-user'), '')
  assert.match(replyInstruction('en'), /English/)
  assert.match(replyInstruction('en'), /Do not switch to the user's language/)
  assert.match(replyInstruction('en'), /Never add Chinese glosses/)
  assert.match(replyInstruction('zh'), /简体中文/)
  assert.match(replyInstruction('zh'), /Never add English glosses/)
})

test('replyReminder is empty for follow-user and reminds otherwise', () => {
  assert.equal(replyReminder('follow-user'), '')
  assert.match(replyReminder('en'), /Mandatory/)
  assert.match(replyReminder('en'), /No Chinese words/)
  assert.match(replyReminder('zh'), /No English glosses/)
})
