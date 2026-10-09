/**
 * Minimal CDP client for DeepSeek Harness Desktop (--remote-debugging-port).
 * Usage:
 *   node _desktop-cdp.mjs eval 'document.title'
 *   node _desktop-cdp.mjs install github:hansjone/netxops
 */

import net from 'node:net'
import http from 'node:http'
import crypto from 'node:crypto'

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

class Cdp {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.id = 0
    this.pending = new Map()
    this.buf = Buffer.alloc(0)
    this.socket = null
  }

  async connect() {
    const u = new URL(this.wsUrl)
    const key = crypto.randomBytes(16).toString('base64')
    await new Promise((resolve, reject) => {
      const socket = net.connect({ host: u.hostname, port: Number(u.port) }, () => {
        socket.write(
          `GET ${u.pathname}${u.search} HTTP/1.1\r\n` +
          `Host: ${u.host}\r\n` +
          `Upgrade: websocket\r\n` +
          `Connection: Upgrade\r\n` +
          `Sec-WebSocket-Key: ${key}\r\n` +
          `Sec-WebSocket-Version: 13\r\n\r\n`,
        )
      })
      socket.on('error', reject)
      socket.once('data', (chunk) => {
        if (!chunk.toString().includes('101')) {
          reject(new Error(`WS upgrade failed: ${chunk.toString('utf8').slice(0, 200)}`))
          return
        }
        this.socket = socket
        const rest = chunk.indexOf('\r\n\r\n')
        if (rest >= 0 && rest + 4 < chunk.length) this.buf = chunk.subarray(rest + 4)
        socket.on('data', (c) => this.onData(c))
        resolve()
      })
    })
  }

  onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk])
    while (true) {
      if (this.buf.length < 2) return
      const b0 = this.buf[0]
      const b1 = this.buf[1]
      const masked = (b1 & 0x80) !== 0
      let len = b1 & 0x7f
      let off = 2
      if (len === 126) {
        if (this.buf.length < 4) return
        len = this.buf.readUInt16BE(2)
        off = 4
      } else if (len === 127) {
        if (this.buf.length < 10) return
        len = Number(this.buf.readBigUInt64BE(2))
        off = 10
      }
      const maskOff = masked ? off : -1
      if (masked) off += 4
      if (this.buf.length < off + len) return
      let payload = this.buf.subarray(off, off + len)
      if (masked) {
        const mask = this.buf.subarray(maskOff, maskOff + 4)
        payload = Buffer.from(payload)
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4]
      }
      this.buf = this.buf.subarray(off + len)
      const opcode = b0 & 0x0f
      if (opcode === 0x1 || opcode === 0x2) {
        try {
          const msg = JSON.parse(payload.toString('utf8'))
          if (msg.id != null && this.pending.has(msg.id)) {
            const { resolve, reject } = this.pending.get(msg.id)
            this.pending.delete(msg.id)
            if (msg.error) reject(new Error(JSON.stringify(msg.error)))
            else resolve(msg.result)
          }
        } catch { /* ignore */ }
      } else if (opcode === 0x8) {
        this.socket?.end()
      } else if (opcode === 0x9) {
        this.sendFrame(0xA, payload)
      }
    }
  }

  sendFrame(opcode, payload) {
    const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload)
    const mask = crypto.randomBytes(4)
    const masked = Buffer.alloc(data.length)
    for (let i = 0; i < data.length; i++) masked[i] = data[i] ^ mask[i % 4]
    let header
    if (data.length < 126) {
      header = Buffer.alloc(6)
      header[0] = 0x80 | opcode
      header[1] = 0x80 | data.length
      mask.copy(header, 2)
    } else if (data.length < 65536) {
      header = Buffer.alloc(8)
      header[0] = 0x80 | opcode
      header[1] = 0x80 | 126
      header.writeUInt16BE(data.length, 2)
      mask.copy(header, 4)
    } else {
      header = Buffer.alloc(14)
      header[0] = 0x80 | opcode
      header[1] = 0x80 | 127
      header.writeBigUInt64BE(BigInt(data.length), 2)
      mask.copy(header, 10)
    }
    this.socket.write(Buffer.concat([header, masked]))
  }

  call(method, params = {}, timeoutMs = 30_000) {
    const id = ++this.id
    const payload = JSON.stringify({ id, method, params })
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.sendFrame(0x1, payload)
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`CDP timeout: ${method}`))
        }
      }, timeoutMs)
    })
  }

  async evaluate(expression, timeoutMs = 30_000) {
    const result = await this.call('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    }, timeoutMs)
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || JSON.stringify(result.exceptionDetails))
    }
    return result.result?.value
  }

  close() {
    this.socket?.end()
  }
}

async function connectPage() {
  const tabs = await httpGetJson('http://127.0.0.1:9222/json')
  const page = tabs.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
  if (!page) throw new Error('no CDP page target')
  const cdp = new Cdp(page.webSocketDebuggerUrl)
  await cdp.connect()
  await cdp.call('Runtime.enable')
  return cdp
}

async function probe(cdp) {
  return cdp.evaluate(`(() => {
    const out = {
      title: document.title,
      url: location.href,
      buttons: [...document.querySelectorAll('button,[role="button"],a')].slice(0, 80).map(el => ({
        text: (el.innerText || el.textContent || '').trim().slice(0, 80),
        aria: el.getAttribute('aria-label') || '',
        testid: el.getAttribute('data-testid') || '',
      })).filter(x => x.text || x.aria),
      inputs: [...document.querySelectorAll('input,textarea')].slice(0, 40).map(el => ({
        type: el.type, placeholder: el.placeholder || '', name: el.name || '', aria: el.getAttribute('aria-label') || '',
      })),
      hasPluginManager: typeof globalThis !== 'undefined',
    }
    // Try to find cordis / remote faces on window
    const keys = Object.keys(window).filter(k => /plugin|dsh|cordis|remote/i.test(k)).slice(0, 40)
    out.windowKeys = keys
    return out
  })()`)
}

async function clickText(cdp, text) {
  return cdp.evaluate(`(() => {
    const want = ${JSON.stringify(text)}
    const els = [...document.querySelectorAll('button,[role="button"],a,div,span,li')]
    const el = els.find(e => {
      const t = (e.innerText || e.textContent || '').trim()
      return t === want || t.includes(want)
    })
    if (!el) return { ok: false, reason: 'not-found' }
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    el.click?.()
    return { ok: true, text: (el.innerText || '').trim().slice(0, 80) }
  })()`)
}

async function ensurePluginsPage(cdp) {
  await cdp.evaluate(`(() => {
    const el = [...document.querySelectorAll('button')].find(e => e.getAttribute('aria-label') === '插件')
    if (el) el.click()
    return true
  })()`)
  await new Promise((r) => setTimeout(r, 800))
}

async function installSpec(cdp, spec) {
  await ensurePluginsPage(cdp)
  const expression = `(async () => {
    const spec = ${JSON.stringify(spec)}
    const sleep = (ms) => new Promise(r => setTimeout(r, ms))
    const open = () => {
      const btn = [...document.querySelectorAll('button')].find(e => (e.innerText || '').trim() === '添加插件')
      if (btn) btn.click()
    }
    let input = document.querySelector('input[aria-label="包名或地址"]')
    if (!input) { open(); await sleep(600); input = document.querySelector('input[aria-label="包名或地址"]') }
    if (!input) return { ok: false, stage: 'no-input', spec }
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, spec)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await sleep(250)
    const installBtn = [...document.querySelectorAll('button')].find(e => (e.innerText || '').trim() === '安装')
    if (!installBtn) return { ok: false, stage: 'no-install-btn', value: input.value, spec }
    if (installBtn.disabled) return { ok: false, stage: 'disabled', value: input.value, spec }
    installBtn.click()
    for (let i = 0; i < 240; i++) {
      await sleep(1000)
      const still = document.querySelector('input[aria-label="包名或地址"]')
      const dlg = document.querySelector('[role="dialog"]')
      const text = dlg?.innerText || ''
      if (!still) return { ok: true, stage: 'dialog-closed', spec, waitedSec: i + 1 }
      // Only inspect dialog body; avoid page-wide false positives.
      if (/这个包没有|无法作为插件安装|安装失败|无法安装：|ENOENT|ERR_PNPM|ERR_PACKAGE|404 Not Found|declares no dsh\.bundle/i.test(text)) {
        return { ok: false, stage: 'error-text', text: text.slice(0, 800), spec, waitedSec: i + 1 }
      }
      if (/正在检查|正在安装|正在下载|Installing|Checking/i.test(text)) continue
    }
    return { ok: false, stage: 'timeout', text: (document.querySelector('[role="dialog"]')?.innerText || '').slice(0, 800), spec }
  })()`
  return cdp.evaluate(expression, 260_000)
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2)
  const cdp = await connectPage()
  try {
    if (cmd === 'eval') {
      const v = await cdp.evaluate(args.join(' '), 60_000)
      console.log(JSON.stringify(v, null, 2))
      return
    }
    if (cmd === 'probe') {
      console.log(JSON.stringify(await probe(cdp), null, 2))
      return
    }
    if (cmd === 'click') {
      console.log(JSON.stringify(await clickText(cdp, args.join(' ')), null, 2))
      return
    }
    if (cmd === 'install') {
      const spec = args.join(' ')
      if (!spec) throw new Error('install requires a package spec')
      console.log(JSON.stringify(await installSpec(cdp, spec), null, 2))
      return
    }
    if (cmd === 'list-installed') {
      await ensurePluginsPage(cdp)
      const v = await cdp.evaluate(`(() => {
        const rows = [...document.querySelectorAll('button,[role="button"]')]
          .map(el => ({ text: (el.innerText || '').trim().slice(0, 80), aria: el.getAttribute('aria-label') || '' }))
          .filter(x => /查看 |启用 |禁用 /.test(x.aria) || /已安装|Installed/.test(x.text))
        const body = document.body.innerText
        const section = body.includes('已安装') ? body.split('已安装')[1]?.slice(0, 1500) : body.slice(0, 1500)
        return { rows: rows.slice(0, 80), section }
      })()`)
      console.log(JSON.stringify(v, null, 2))
      return
    }
    console.error('usage: eval|probe|click|install|list-installed')
    process.exit(2)
  } finally {
    cdp.close()
  }
}

await main()
