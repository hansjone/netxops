import { createRequire } from "node:module";
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// src/index.ts
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { dirname, join as join2 } from "node:path";
import { fileURLToPath } from "node:url";
import z from "@deepseek-ai/schemastery";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import * as DshSettings from "@deepseek-ai/dsh-settings";

// src/netx/alarm-push-status.ts
var STORE_KEY = Symbol.for("dsh-netxops.alarm-push-status");
function emptyStatus(partial = {}) {
  return {
    phase: "disabled",
    enabled: false,
    wsUrl: "",
    detail: "",
    updatedAt: Date.now(),
    lastConnectedAt: null,
    lastError: null,
    ...partial
  };
}
function store() {
  const root = globalThis;
  let current = root[STORE_KEY];
  if (current === undefined) {
    current = { status: emptyStatus(), listeners: new Set };
    root[STORE_KEY] = current;
  }
  return current;
}
function getAlarmPushStatus() {
  return { ...store().status };
}
function publishAlarmPushStatus(next) {
  const state = store();
  state.status = {
    ...state.status,
    ...next,
    updatedAt: Date.now()
  };
  for (const listener of state.listeners)
    listener();
}
function resetAlarmPushStatus() {
  publishAlarmPushStatus(emptyStatus({ phase: "disabled", enabled: false }));
}

// src/netx/alarm-push.ts
function alarmSubscribeUrl(apiUrl) {
  const trimmed = apiUrl.trim().replace(/\/$/, "");
  if (!trimmed)
    return "";
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return "";
  }
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/v1/integrations/dsh-alarm/ws";
  url.search = "";
  url.hash = "";
  return url.toString();
}
function formatAlarmPrompt(payload, lang = "zh") {
  const action = String(payload.action ?? "").trim().toLowerCase();
  const actionZh = {
    inserted: "告警产生",
    updated: "告警更新",
    deleted: "告警清除"
  };
  const actionEn = {
    inserted: "Alarm Raised",
    updated: "Alarm Updated",
    deleted: "Alarm Cleared"
  };
  const ne = payload.ne && typeof payload.ne === "object" ? payload.ne : {};
  const host = String(ne.host_name ?? "").trim();
  const ip = String(ne.ip_address ?? "").trim();
  const neName = String(ne.ne_name ?? ne.user_label ?? "").trim();
  let device = host || neName || String(payload.ne_id ?? "").trim() || "-";
  if (ip)
    device = device === "-" ? ip : `${device} (${ip})`;
  const label = String(payload.rule_label ?? payload.native_probable_cause ?? "关键告警").trim();
  if (lang.startsWith("en")) {
    return [
      `[UME ${actionEn[action] ?? (action || "Alarm")}] ${label}`,
      `Device: ${device}`,
      `Object: ${String(payload.object_name ?? "-").trim()}`,
      `Severity: ${String(payload.perceived_severity ?? "-").trim()}`,
      `Cause: ${String(payload.native_probable_cause ?? "-").trim()}`,
      `Time: ${String(payload.time_created ?? "-").trim()}`,
      `notificationId: ${String(payload.notification_id ?? "-").trim()}`,
      `alarm_key: ${String(payload.alarm_key ?? "-").trim()}`,
      "",
      "Please analyze this key alarm and suggest next ops steps."
    ].join(`
`);
  }
  return [
    `[UME ${actionZh[action] ?? (action || "告警")}] ${label}`,
    `设备: ${device}`,
    `对象: ${String(payload.object_name ?? "-").trim()}`,
    `级别: ${String(payload.perceived_severity ?? "-").trim()}`,
    `原因: ${String(payload.native_probable_cause ?? "-").trim()}`,
    `时间: ${String(payload.time_created ?? "-").trim()}`,
    `notificationId: ${String(payload.notification_id ?? "-").trim()}`,
    `alarm_key: ${String(payload.alarm_key ?? "-").trim()}`,
    "",
    "请分析这条关键告警并给出下一步运维建议。"
  ].join(`
`);
}
function setPhase(phase, wsUrl, extra = {}) {
  publishAlarmPushStatus({
    phase,
    enabled: true,
    wsUrl,
    detail: extra.detail ?? "",
    lastError: extra.lastError === undefined ? null : extra.lastError,
    ...extra.lastConnectedAt !== undefined ? { lastConnectedAt: extra.lastConnectedAt } : {}
  });
}
function startAlarmPushClient(options) {
  const log = options.logger ?? console;
  const wsUrl = alarmSubscribeUrl(options.apiUrl);
  const token = options.token.trim();
  if (!wsUrl || !token) {
    log.warn?.("netxops alarm-push: missing apiUrl or token — not connecting");
    setPhase("error", wsUrl, {
      detail: "missing_url_or_token",
      lastError: "missing apiUrl or token"
    });
    return () => {};
  }
  const WS = options.WebSocketImpl ?? globalThis.WebSocket;
  if (typeof WS !== "function") {
    log.error?.("netxops alarm-push: WebSocket is unavailable in this runtime");
    setPhase("error", wsUrl, {
      detail: "websocket_unavailable",
      lastError: "WebSocket unavailable"
    });
    return () => {};
  }
  let closed = false;
  let socket = null;
  let reconnectTimer;
  let attempt = 0;
  const baseDelay = Math.max(500, options.reconnectMs ?? 2000);
  const clearReconnect = () => {
    if (reconnectTimer !== undefined) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
  };
  const scheduleReconnect = (reason) => {
    if (closed)
      return;
    clearReconnect();
    const delay = Math.min(60000, baseDelay * 2 ** Math.min(attempt, 5));
    attempt += 1;
    setPhase("reconnecting", wsUrl, {
      detail: `retry_in_${delay}ms`,
      lastError: reason
    });
    reconnectTimer = setTimeout(() => {
      connect();
    }, delay);
  };
  const connect = () => {
    if (closed)
      return;
    clearReconnect();
    setPhase(attempt > 0 ? "reconnecting" : "connecting", wsUrl, { detail: "dialing" });
    try {
      socket = new WS(wsUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn?.("netxops alarm-push: connect failed:", error);
      scheduleReconnect(message);
      return;
    }
    socket.addEventListener("open", () => {
      setPhase("authenticating", wsUrl, { detail: "auth" });
      socket?.send(JSON.stringify({ type: "auth", token }));
    });
    socket.addEventListener("message", (event) => {
      let msg;
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const type = String(msg.type ?? "").toLowerCase();
      if (type === "auth-ok") {
        attempt = 0;
        const now = Date.now();
        setPhase("connected", wsUrl, {
          detail: String(msg.user ?? "ok"),
          lastError: null,
          lastConnectedAt: now
        });
        log.info?.("netxops alarm-push: subscribed to %s", wsUrl);
        return;
      }
      if (type === "auth-fail") {
        const err = String(msg.error ?? "auth_failed");
        log.error?.("netxops alarm-push: auth failed (%s)", err);
        setPhase("auth_failed", wsUrl, { detail: err, lastError: err });
        socket?.close();
        return;
      }
      if (type === "pong")
        return;
      if (type === "event" && String(msg.event ?? "") === "netx.alarm") {
        const payload = msg.payload && typeof msg.payload === "object" ? msg.payload : {};
        Promise.resolve(options.onAlarm(payload)).catch((error) => {
          log.warn?.("netxops alarm-push: handler failed:", error);
        });
      }
    });
    socket.addEventListener("close", () => {
      socket = null;
      if (!closed)
        scheduleReconnect("socket_closed");
    });
    socket.addEventListener("error", () => {});
  };
  const pingTimer = setInterval(() => {
    if (socket && socket.readyState === WS.OPEN) {
      try {
        socket.send(JSON.stringify({ type: "ping", ts: new Date().toISOString() }));
      } catch {}
    }
  }, 25000);
  connect();
  return () => {
    closed = true;
    clearReconnect();
    clearInterval(pingTimer);
    try {
      socket?.close();
    } catch {}
    socket = null;
  };
}

// src/netx/alarm-session.ts
import { homedir } from "node:os";
import { join } from "node:path";
var PRESET_ID = "netxops";
var PERMISSION_PRESET = "default";
var TITLE = "Netx 关键告警";
var sticky = null;
function resolveWorkspacePath() {
  const fromEnv = process.env.DSH_HOME?.trim();
  const home = fromEnv && fromEnv.length > 0 ? fromEnv : join(homedir(), ".dsh");
  return join(home, "workspaces", "netxops-alarms");
}
async function deliverAlarmToSession(ctx, payload, lang = "zh") {
  const prompt = formatAlarmPrompt(payload, lang);
  const agents = ctx.agents;
  if (!agents || typeof agents.create !== "function") {
    ctx.logger.warn("netxops alarm-push: ctx.agents unavailable — enable a profile that mounts agents to receive alarms in a DSH session");
    return;
  }
  if (sticky?.agent && typeof sticky.agent.followup === "function") {
    try {
      await followup(ctx, sticky.agent, prompt);
      return;
    } catch (error) {
      ctx.logger.warn("netxops alarm-push: sticky followup failed, recreating session: %s", error);
      sticky = null;
    }
  }
  await createStickySession(ctx, prompt);
}
async function followup(ctx, agent, prompt) {
  let createUserMessage;
  try {
    const mod = await import("@deepseek-ai/dsh-llm");
    createUserMessage = mod.createUserMessage;
    if (typeof createUserMessage !== "function")
      throw new Error("createUserMessage missing");
    const summary = typeof mod.boundContextSummary === "function" ? mod.boundContextSummary("netx key alarm") : "netx key alarm";
    agent.followup(createUserMessage({
      content: [{ type: "text", text: prompt }],
      source: {
        kind: "webhook",
        provider: "netx",
        source: "dsh-alarm-hub",
        form: "notice",
        summary
      }
    }));
  } catch (error) {
    const anyAgent = agent;
    if (typeof anyAgent.prompt === "function") {
      await anyAgent.prompt(prompt);
      return;
    }
    ctx.logger.warn("netxops alarm-push: cannot build user message (%s)", error);
    throw error;
  }
}
async function createStickySession(ctx, prompt) {
  const c = ctx;
  const agents = c.agents;
  const agentPresets = c.agentPresets;
  const workspaceRegistry = c.workspaceRegistry;
  const permissionPresets = c.permissionPresets;
  const sessionTitle = c.sessionTitle;
  const agentDefaultModel = c.agentDefaultModel;
  if (!agentPresets || typeof agentPresets.resolve !== "function" || !workspaceRegistry || typeof workspaceRegistry.create !== "function") {
    ctx.logger.warn("netxops alarm-push: agentPresets/workspaceRegistry unavailable — cannot create a DSH session");
    return;
  }
  if (permissionPresets && typeof permissionPresets.resolve === "function") {
    try {
      permissionPresets.resolve(PERMISSION_PRESET);
    } catch {
      ctx.logger.warn("netxops alarm-push: permission preset %s missing", PERMISSION_PRESET);
    }
  }
  const preset = await agentPresets.resolve(PRESET_ID);
  if (typeof agentPresets.standingKeyFor === "function") {
    await agentPresets.standingKeyFor(preset.id);
  }
  const selected = typeof agentDefaultModel?.currentSelection === "function" ? agentDefaultModel.currentSelection() : { provider: "deepseek", model: "deepseek-chat" };
  const workspacePath = resolveWorkspacePath();
  const workspace = await workspaceRegistry.create(workspacePath);
  const sessionId = `netxops-alarm-${Date.now().toString(36)}`;
  const handle = await agents.create({
    sessionId,
    meta: { cwd: workspace.path, agentPreset: preset.id },
    agentOptions: { provider: selected.provider, model: selected.model },
    setup: async (agentCtx) => {
      if (typeof agentPresets.mount === "function") {
        await agentPresets.mount(agentCtx, preset.id);
      }
    }
  });
  try {
    if (typeof workspace.attachSession === "function") {
      await workspace.attachSession(sessionId);
    }
    if (permissionPresets && typeof permissionPresets.set === "function") {
      permissionPresets.set(handle.agent.session, PERMISSION_PRESET);
    }
    if (sessionTitle && typeof sessionTitle.rename === "function") {
      sessionTitle.rename(handle.agent.session, TITLE);
    }
    await followup(ctx, handle.agent, prompt);
    sticky = { sessionId, agent: handle.agent };
    ctx.logger.info("netxops alarm-push: opened sticky session %s", sessionId);
  } catch (error) {
    try {
      await handle.dispose?.();
    } catch {}
    throw error;
  }
}
function resetAlarmSession() {
  sticky = null;
}

// src/netx/runtime.ts
var STORE_KEY2 = Symbol.for("dsh-netxops.connection-store");
function store2() {
  const root = globalThis;
  let current = root[STORE_KEY2];
  if (current === undefined) {
    current = { connection: undefined, listeners: new Set };
    root[STORE_KEY2] = current;
  }
  return current;
}
function publishNetxConnection(next) {
  const state = store2();
  state.connection = next;
  for (const listener of state.listeners)
    listener();
}

// src/index.ts
var name = "netxops";
var inject = ["credentials"];
var NETXOPS_RPC_CHANNEL = "/netxops";
var NETXOPS_SETTINGS_NAMESPACE = "netxops";
var NETXOPS_PRESET_ID = "netxops";
var DEFAULT_TOKEN_REF = "NETX_API_TOKEN";
var Config = z.object({
  apiUrl: z.string().default("http://127.0.0.1:8890"),
  lang: z.string().default("zh"),
  tokenCredentialRef: z.string().role("credential-ref").default(DEFAULT_TOKEN_REF),
  toolCallTimeoutMs: z.number().step(1).min(1000).default(120000),
  installAgentPreset: z.boolean().default(true),
  alarmPushEnabled: z.boolean().default(false)
});
function packageRoot() {
  return join2(dirname(fileURLToPath(import.meta.url)), "..");
}
function resolveDshHome() {
  const fromEnv = process.env.DSH_HOME?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0)
    return fromEnv;
  return join2(homedir2(), ".dsh");
}
function ensureAgentPresetInstalled(logger) {
  const src = join2(packageRoot(), "presets", NETXOPS_PRESET_ID);
  const composition = join2(src, "agent.cordis.yml");
  if (!existsSync(composition)) {
    logger.warn("netxops: bundled preset missing at %s — skip user-preset install", src);
    return;
  }
  const destParent = join2(resolveDshHome(), ".agent-presets");
  const dest = join2(destParent, NETXOPS_PRESET_ID);
  try {
    mkdirSync(destParent, { recursive: true });
    if (existsSync(dest)) {
      rmSync(dest, { recursive: true, force: true });
    }
    cpSync(src, dest, { recursive: true });
    writeFileSync(join2(dest, ".dsh-netxops-managed"), `${new Date().toISOString()}
`, "utf8");
    logger.info("netxops: agent preset installed at %s", dest);
  } catch (error) {
    logger.error("netxops: failed to install agent preset: %s", error);
  }
}
async function resolveToken(ctx, refName) {
  const hit = await ctx.credentials.resolve(credentialRef(refName));
  return hit?.value ?? "";
}
function installNetxopsSettings(ctx, entry, hooks) {
  const legacy = DshSettings.installSettingsSection;
  if (typeof legacy === "function") {
    legacy(ctx, NETXOPS_SETTINGS_NAMESPACE, Config, entry, hooks);
    return;
  }
  ctx.inject(["settings"], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, NETXOPS_SETTINGS_NAMESPACE, Config, entry, hooks);
  });
}
function apply(ctx, config = Config({})) {
  let source = () => config;
  let publishing = Promise.resolve();
  let generation = 0;
  let stopAlarmPush;
  if (config.installAgentPreset) {
    ensureAgentPresetInstalled(ctx.logger);
  }
  const restartAlarmPush = (apiUrl, token, enabled, lang) => {
    stopAlarmPush?.();
    stopAlarmPush = undefined;
    resetAlarmSession();
    if (!enabled) {
      resetAlarmPushStatus();
      return;
    }
    if (!token.trim()) {
      ctx.logger.warn("netxops alarm-push: enabled but token is empty — not connecting");
      publishAlarmPushStatus({
        phase: "error",
        enabled: true,
        wsUrl: "",
        detail: "missing_token",
        lastError: "token empty"
      });
      return;
    }
    stopAlarmPush = startAlarmPushClient({
      apiUrl,
      token,
      logger: ctx.logger,
      onAlarm: (payload) => deliverAlarmToSession(ctx, payload, lang)
    });
  };
  const publish = () => {
    publishing = publishing.then(async () => {
      const gen = ++generation;
      const current = source();
      const token = await resolveToken(ctx, current.tokenCredentialRef);
      if (gen !== generation)
        return;
      const apiUrl = current.apiUrl.replace(/\/$/, "");
      const tokenConfigured = token.trim().length > 0;
      publishNetxConnection({
        apiUrl,
        token,
        lang: current.lang,
        toolCallTimeoutMs: current.toolCallTimeoutMs
      });
      restartAlarmPush(apiUrl, token, current.alarmPushEnabled === true, current.lang);
      if (!tokenConfigured) {
        ctx.logger.warn("netxops: published connection → %s tokenConfigured=false (set credential %s)", apiUrl, current.tokenCredentialRef);
      } else {
        ctx.logger.info("netxops: published connection → %s tokenConfigured=true alarmPush=%s", apiUrl, current.alarmPushEnabled === true);
      }
    }).catch((error) => {
      ctx.logger.error("netxops: connection publish error: %s", error);
    });
  };
  publish();
  installNetxopsSettings(ctx, config, {
    setSource: (current) => {
      source = current;
    },
    onChange: () => {
      publish();
    }
  });
  ctx.on("credentials/reference-updated", (ref) => {
    if (String(ref) === source().tokenCredentialRef)
      publish();
  });
  ctx.inject(["connection"], (connCtx) => {
    const rpc = connCtx.connection?.rpc;
    if (!rpc || typeof rpc.handle !== "function") {
      connCtx.logger.warn("netxops: connection.rpc.handle unavailable — alarm status UI disabled");
      return;
    }
    connCtx.effect(() => {
      const dispose = rpc.handle(NETXOPS_RPC_CHANNEL, async (endpoint) => {
        if (endpoint !== "alarm-push.status") {
          return { ok: false, error: { code: "bad-request", message: "Unknown endpoint." } };
        }
        return { ok: true, value: getAlarmPushStatus() };
      });
      return () => {
        dispose();
      };
    }, "netxops: alarm-push status rpc");
  });
  ctx.effect(() => () => {
    generation += 1;
    stopAlarmPush?.();
    stopAlarmPush = undefined;
    resetAlarmSession();
    resetAlarmPushStatus();
  }, "netxops: dispose host bridge");
}
export {
  name,
  inject,
  ensureAgentPresetInstalled,
  apply,
  NETXOPS_SETTINGS_NAMESPACE,
  NETXOPS_RPC_CHANNEL,
  NETXOPS_PRESET_ID,
  DEFAULT_TOKEN_REF,
  Config
};
