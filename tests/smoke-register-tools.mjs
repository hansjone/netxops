/**
 * Smoke: prove dsh-netxops/tools + host can register netx__* against a fake registry.
 * Run: node tests/smoke-register-tools.mjs
 */

import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const STORE_KEY = Symbol.for('dsh-netxops.connection-store')

function connectionStore() {
  return globalThis[STORE_KEY]
}

function resetConnectionStore() {
  const state = connectionStore()
  if (state) {
    state.connection = undefined
    state.listeners.clear()
  }
}

function createLogger(tag) {
  const lines = []
  const log = (level, ...args) => {
    const msg = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ')
    lines.push(`[${level}] ${msg}`)
    console.log(`[${tag}/${level}]`, ...args)
  }
  return {
    lines,
    info: (...a) => log('info', ...a),
    warn: (...a) => log('warn', ...a),
    error: (...a) => log('error', ...a),
    debug: (...a) => log('debug', ...a),
  }
}

/**
 * Minimal cordis-like Context: tools.register records names;
 * inject runs when all named services exist on ctx; effect runs immediately.
 */
function createFakeCtx(services = {}) {
  const registered = []
  const effects = []
  const logger = createLogger(services._tag ?? 'ctx')

  const ctx = {
    logger,
    tools: {
      register(entry) {
        const name = entry?.name ?? String(entry)
        registered.push(name)
        return () => {
          const i = registered.indexOf(name)
          if (i >= 0) registered.splice(i, 1)
        }
      },
    },
    skills: {
      register() {
        return () => {}
      },
    },
    credentials: {
      async resolve() {
        return { value: 'smoke-token' }
      },
    },
    settings: {
      installSection() {},
      describe() {
        return []
      },
      get() {
        return undefined
      },
    },
    systemPrompt: {
      section() {
        return () => {}
      },
      context() {
        return () => {}
      },
    },
    get(name) {
      return ctx[name]
    },
    inject(deps, callback) {
      const list = Array.isArray(deps) ? deps : [deps]
      const missing = list.filter((d) => ctx[d] === undefined && services[d] === undefined)
      if (missing.length > 0) {
        // Soft-inject semantics: wait forever (never call) when deps absent.
        return
      }
      // Merge optional service overrides, then invoke.
      for (const d of list) {
        if (services[d] !== undefined) ctx[d] = services[d]
      }
      try {
        callback(ctx)
      } catch (error) {
        logger.error('inject callback threw: %s', error)
        throw error
      }
    },
    effect(factory, label) {
      try {
        const dispose = factory()
        effects.push({ label, dispose })
        return typeof dispose === 'function' ? dispose : () => {}
      } catch (error) {
        logger.error('effect %s threw: %s', label, error)
        throw error
      }
    },
    on() {
      return () => {}
    },
    ...services,
  }

  // Ensure tools always present unless explicitly removed
  if (services.tools === undefined && ctx.tools) {
    // keep default
  }

  return { ctx, registered, effects, logger }
}

function disposeAll(effects) {
  for (const { dispose } of effects.splice(0)) {
    try {
      if (typeof dispose === 'function') dispose()
    } catch {
      // ignore
    }
  }
}

async function smokeAgentTools() {
  console.log('\n=== A) agent-tools apply (provisional connection) ===')
  resetConnectionStore()

  const mod = await import(pathToFileURL(join(root, 'lib/agent-tools.js')).href)
  assert.equal(mod.name, 'netxops-tools')
  assert.deepEqual(mod.inject, ['tools'])
  assert.equal(typeof mod.apply, 'function')

  const { ctx, registered, effects, logger } = createFakeCtx({ _tag: 'agent-tools' })
  // Only tools — skills inject should soft-skip (not block tool registration)
  delete ctx.skills

  let thrown = null
  try {
    mod.apply(ctx)
  } catch (error) {
    thrown = error
    console.error('agent-tools apply threw:', error)
  }

  const netx = registered.filter((n) => String(n).startsWith('netx__'))
  const hasQuery = netx.includes('netx__queryNmsAlarms')
  const sample = netx.slice(0, 12)

  console.log('registered count:', registered.length)
  console.log('netx__ count:', netx.length)
  console.log('sample:', sample)
  console.log('has netx__queryNmsAlarms:', hasQuery)
  console.log('logger errors:', logger.lines.filter((l) => l.startsWith('[error]')))

  disposeAll(effects)

  return {
    ok: thrown === null && hasQuery && netx.length >= 10,
    thrown,
    count: netx.length,
    names: netx,
    sample,
    hasQuery,
  }
}

async function smokeHostPublish() {
  console.log('\n=== B) host apply (provisional publish + public tools) ===')
  resetConnectionStore()

  const mod = await import(pathToFileURL(join(root, 'lib/index.js')).href)
  assert.equal(mod.name, 'netxops')
  assert.equal(typeof mod.apply, 'function')
  assert.equal(typeof mod.Config, 'function')

  const publicRegistered = []
  const { ctx, effects, logger } = createFakeCtx({
    _tag: 'host',
    tools: {
      register(entry) {
        const name = entry?.name ?? String(entry)
        publicRegistered.push(name)
        return () => {
          const i = publicRegistered.indexOf(name)
          if (i >= 0) publicRegistered.splice(i, 1)
        }
      },
    },
  })

  const config = mod.Config({
    apiUrl: 'http://127.0.0.1:8890',
    installAgentPreset: false,
    alarmPushEnabled: false,
    groupOpsInPreset: true,
    groupOpsPublic: true,
    groupBizMonitorInPreset: true,
    groupBizMonitorPublic: false,
    groupTopologyInPreset: false,
    groupTopologyPublic: false,
    groupKbInPreset: false,
    groupKbPublic: false,
  })

  let thrown = null
  try {
    mod.apply(ctx, config)
  } catch (error) {
    thrown = error
    console.error('host apply threw:', error)
  }

  // Allow async publish() (credentials resolve) one tick
  await new Promise((r) => setTimeout(r, 50))

  const store = connectionStore()
  const conn = store?.connection
  const provisionalOk = Boolean(conn?.apiUrl)
  const hostNetx = publicRegistered.filter((n) => String(n).startsWith('netx__'))
  const hasQueryHost = hostNetx.includes('netx__queryNmsAlarms')

  console.log('connection published:', provisionalOk, conn?.apiUrl, 'tokenConfigured=', Boolean(conn?.token?.trim()))
  console.log('host netx__ count:', hostNetx.length)
  console.log('host sample:', hostNetx.slice(0, 8))
  console.log('has host netx__queryNmsAlarms:', hasQueryHost)
  console.log('logger errors:', logger.lines.filter((l) => l.startsWith('[error]')))

  disposeAll(effects)

  return {
    ok: thrown === null && provisionalOk && hasQueryHost && hostNetx.length >= 5,
    thrown,
    provisionalOk,
    apiUrl: conn?.apiUrl,
    tokenConfigured: Boolean(conn?.token?.trim()),
    publicCount: hostNetx.length,
    publicSample: hostNetx.slice(0, 8),
    hasQueryPublic: hasQueryHost,
  }
}

async function smokeHostThenAgent() {
  console.log('\n=== C) host publish then agent-tools remount ===')
  resetConnectionStore()

  const host = await import(pathToFileURL(join(root, 'lib/index.js')).href)
  const tools = await import(pathToFileURL(join(root, 'lib/agent-tools.js')).href)

  const hostBag = createFakeCtx({ _tag: 'host-c' })
  // Host without tools — only publish path
  delete hostBag.ctx.tools
  delete hostBag.ctx.skills

  const agentBag = createFakeCtx({ _tag: 'agent-c' })
  delete agentBag.ctx.skills

  host.apply(
    hostBag.ctx,
    host.Config({
      apiUrl: 'http://10.0.0.1:8890',
      installAgentPreset: false,
      alarmPushEnabled: false,
      groupOpsInPreset: true,
      groupOpsPublic: false,
      groupKbInPreset: false,
    }),
  )
  await new Promise((r) => setTimeout(r, 50))

  tools.apply(agentBag.ctx)
  await new Promise((r) => setTimeout(r, 20))

  const netx = agentBag.registered.filter((n) => String(n).startsWith('netx__'))
  const store = connectionStore()?.connection
  console.log('live apiUrl:', store?.apiUrl)
  console.log('agent netx__ count:', netx.length)
  console.log('has query:', netx.includes('netx__queryNmsAlarms'))

  disposeAll(hostBag.effects)
  disposeAll(agentBag.effects)

  return {
    ok: netx.includes('netx__queryNmsAlarms') && store?.apiUrl?.includes('10.0.0.1'),
    count: netx.length,
    apiUrl: store?.apiUrl,
  }
}

const results = {
  agentTools: await smokeAgentTools(),
  host: await smokeHostPublish(),
  combined: await smokeHostThenAgent(),
}

console.log('\n=== SUMMARY ===')
console.log(JSON.stringify({
  agentTools: {
    pass: results.agentTools.ok,
    count: results.agentTools.count,
    hasQuery: results.agentTools.hasQuery,
    sample: results.agentTools.sample,
    error: results.agentTools.thrown ? String(results.agentTools.thrown) : null,
  },
  host: {
    pass: results.host.ok,
    provisionalOk: results.host.provisionalOk,
    apiUrl: results.host.apiUrl,
    tokenConfigured: results.host.tokenConfigured,
    publicCount: results.host.publicCount,
    publicSample: results.host.publicSample,
    error: results.host.thrown ? String(results.host.thrown) : null,
  },
  combined: {
    pass: results.combined.ok,
    count: results.combined.count,
    apiUrl: results.combined.apiUrl,
  },
}, null, 2))

const pass = results.agentTools.ok && results.host.ok && results.combined.ok
if (!pass) {
  console.error('\nSMOKE FAIL')
  process.exitCode = 1
} else {
  console.log('\nSMOKE PASS')
}
