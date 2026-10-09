/**
 * Enable local linked plugins via Desktop CDP (one plugin per eval).
 * Usage: node _enable-local-plugins.mjs
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cdp = path.join(__dirname, '_desktop-cdp.mjs')
const NAMES = [
  'dsh-search-mcp',
  'dsh-trilium',
  'uds-auth',
  'dsh-ops-cron',
  'dsh-netxops',
  'dsh-im-ops',
  'dsh-mind-map',
]

function runEval(code, timeoutMs = 90_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cdp, 'eval', code], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let out = ''
    let err = ''
    const t = setTimeout(() => {
      child.kill()
      reject(new Error(`timeout after ${timeoutMs}ms: ${err || out}`))
    }, timeoutMs)
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { err += d })
    child.on('close', (code) => {
      clearTimeout(t)
      if (code !== 0) reject(new Error(err || out || `exit ${code}`))
      else {
        try { resolve(JSON.parse(out)) } catch { resolve(out) }
      }
    })
  })
}

function enableOne(name) {
  // Keep under CDP 60s eval timeout
  return runEval(`(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  const byAria = a => [...document.querySelectorAll('button')].find(e => (e.getAttribute('aria-label')||'') === a)
  const clickText = t => {
    const b = [...document.querySelectorAll('button')].find(e => (e.innerText||'').trim() === t)
    if (b) { b.click(); return true }
    return false
  }
  byAria('插件')?.click(); await sleep(800)
  const steps = []
  const en = byAria('启用 ' + ${JSON.stringify(name)})
  if (en) { en.click(); steps.push('启用'); await sleep(2500) }
  byAria('查看 ' + ${JSON.stringify(name)})?.click(); await sleep(900)
  if (clickText('立即启用')) { steps.push('立即启用'); await sleep(2800) }
  byAria('返回插件列表')?.click(); await sleep(350)
  byAria('查看 ' + ${JSON.stringify(name)})?.click(); await sleep(700)
  const t = document.body.innerText || ''
  const idx = t.indexOf(${JSON.stringify(name)})
  const bit = idx >= 0 ? t.slice(idx, idx + 280) : ''
  const running = /运行中/.test(bit)
  const enableStill = !!byAria('启用 ' + ${JSON.stringify(name)})
  byAria('返回插件列表')?.click()
  return { name: ${JSON.stringify(name)}, steps, running, enableStill, bit: bit.slice(0, 200) }
})()`, 70_000)
}

const results = []
for (const name of NAMES) {
  try {
    const r = await enableOne(name)
    results.push(r)
    console.log(JSON.stringify(r))
  } catch (e) {
    results.push({ name, error: String(e.message || e).slice(0, 300) })
    console.error(name, e.message || e)
  }
}

const cron = await runEval(`(() => ({ hasCron: /定时任务/.test(document.body.innerText||''), head: (document.body.innerText||'').slice(0,120) }))()`)
console.log(JSON.stringify({ results, cron }, null, 2))
