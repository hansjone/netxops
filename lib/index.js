import { createRequire } from "node:module";
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// src/index.ts
import { cpSync, existsSync as existsSync2, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir as homedir3 } from "node:os";
import { dirname as dirname2, join as join3 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
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
      `[NMS ${actionEn[action] ?? (action || "Alarm")}] ${label}`,
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
    `[NMS ${actionZh[action] ?? (action || "告警")}] ${label}`,
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
  let haltReconnect = false;
  let subscribed = false;
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
    if (closed || haltReconnect)
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
    if (closed || haltReconnect)
      return;
    clearReconnect();
    subscribed = false;
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
        subscribed = true;
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
        log.error?.("netxops alarm-push: auth failed (%s) — not reconnecting until settings/token change", err);
        subscribed = false;
        haltReconnect = true;
        clearReconnect();
        setPhase("auth_failed", wsUrl, { detail: err, lastError: err });
        try {
          socket?.close();
        } catch {}
        return;
      }
      if (type === "pong")
        return;
      if (type === "event" && String(msg.event ?? "") === "netx.alarm") {
        if (!subscribed) {
          log.warn?.("netxops alarm-push: ignoring alarm before auth-ok");
          return;
        }
        const payload = msg.payload && typeof msg.payload === "object" ? msg.payload : {};
        Promise.resolve(options.onAlarm(payload)).catch((error) => {
          log.warn?.("netxops alarm-push: handler failed:", error);
        });
      }
    });
    socket.addEventListener("close", () => {
      socket = null;
      subscribed = false;
      if (!closed && !haltReconnect)
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

// src/netx/im-targets.ts
function imTargetKey(botId, targetId) {
  return `${botId}::${targetId}`;
}
function normalizeImTarget(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    return null;
  const row = input;
  const botId = typeof row.botId === "string" ? row.botId.trim() : "";
  const targetId = typeof row.targetId === "string" ? row.targetId.trim() : "";
  if (!botId || !targetId)
    return null;
  return { botId, targetId };
}
function parseImTargetsJson(text) {
  const trimmed = text.trim();
  if (!trimmed)
    return [];
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed))
    return [];
  const out = [];
  const seen = new Set;
  for (const entry of parsed) {
    const target = normalizeImTarget(entry);
    if (!target)
      continue;
    const key = imTargetKey(target.botId, target.targetId);
    if (seen.has(key))
      continue;
    seen.add(key);
    out.push(target);
  }
  return out;
}
function resolveImTargets(settings) {
  const fromList = parseImTargetsJson(typeof settings.imTargets === "string" ? settings.imTargets : "");
  if (fromList.length > 0)
    return fromList;
  const legacy = normalizeImTarget({
    botId: settings.imBotId,
    targetId: settings.imTargetId
  });
  return legacy ? [legacy] : [];
}

// src/netx/alarm-im.ts
function resolveTargets(options) {
  if (options.targets && options.targets.length > 0) {
    const out = [];
    const seen = new Set;
    for (const entry of options.targets) {
      const target = normalizeImTarget(entry);
      if (!target)
        continue;
      const key = `${target.botId}::${target.targetId}`;
      if (seen.has(key))
        continue;
      seen.add(key);
      out.push(target);
    }
    return out;
  }
  return resolveImTargets({
    imTargets: options.imTargets,
    imBotId: options.botId,
    imTargetId: options.targetId
  });
}
async function deliverAlarmToIm(ctx, payload, options) {
  if (!options.enabled)
    return;
  const targets = resolveTargets(options);
  if (targets.length === 0) {
    ctx.logger.warn("netxops alarm-im: enabled but no delivery targets — skip IM delivery (pick one or more targets under Netx Ops → IM)");
    return;
  }
  const im = (typeof ctx.get === "function" ? ctx.get("dshIm") : undefined) ?? ctx.dshIm;
  if (!im || typeof im.send !== "function") {
    ctx.logger.warn("netxops alarm-im: ctx.dshIm unavailable — install/enable dsh-im-ops to deliver alarms to WhatsApp/IM");
    return;
  }
  const text = formatAlarmPrompt(payload, options.lang);
  const results = await Promise.allSettled(targets.map((target) => im.send(target.botId, target.targetId, text)));
  results.forEach((result, index) => {
    const target = targets[index];
    if (result.status === "fulfilled") {
      ctx.logger.info("netxops alarm-im: sent to botId=%s targetId=%s", target.botId, target.targetId);
      return;
    }
    ctx.logger.warn("netxops alarm-im: send failed botId=%s targetId=%s: %s", target.botId, target.targetId, result.reason);
  });
}

// src/netx/alarm-session.ts
import { homedir } from "node:os";
import { join } from "node:path";
var PRESET_ID = "netxops";
var PERMISSION_PRESET = "default";
var TITLE = "Netx 关键告警";
var sticky = null;
var deliveryChain = Promise.resolve();
function resolveWorkspacePath() {
  const fromEnv = process.env.DSH_HOME?.trim();
  const home = fromEnv && fromEnv.length > 0 ? fromEnv : join(homedir(), ".dsh");
  return join(home, "workspaces", "netxops-alarms");
}
async function disposeSticky(handle) {
  if (!handle)
    return;
  try {
    await handle.dispose?.();
  } catch {}
}
async function deliverAlarmToSession(ctx, payload, lang = "zh") {
  const run = async () => {
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
        const previous = sticky;
        sticky = null;
        await disposeSticky(previous);
      }
    }
    await createStickySession(ctx, prompt);
  };
  const next = deliveryChain.then(run, run);
  deliveryChain = next.then(() => {
    return;
  }, () => {
    return;
  });
  await next;
}
async function followup(ctx, agent, prompt) {
  let createUserMessage;
  try {
    const mod = await import("@deepseek-ai/dsh-llm");
    createUserMessage = mod.createUserMessage;
    if (typeof createUserMessage !== "function")
      throw new Error("createUserMessage missing");
    const summary = typeof mod.boundContextSummary === "function" ? mod.boundContextSummary("netx key alarm") : "netx key alarm";
    await Promise.resolve(agent.followup(createUserMessage({
      content: [{ type: "text", text: prompt }],
      source: {
        kind: "webhook",
        provider: "netx",
        source: "dsh-alarm-hub",
        form: "notice",
        summary
      }
    })));
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
    sticky = {
      sessionId,
      agent: handle.agent,
      dispose: typeof handle.dispose === "function" ? () => handle.dispose() : undefined
    };
    ctx.logger.info("netxops alarm-push: opened sticky session %s", sessionId);
  } catch (error) {
    try {
      await handle.dispose?.();
    } catch {}
    throw error;
  }
}
function resetAlarmSession() {
  const previous = sticky;
  sticky = null;
  disposeSticky(previous);
}

// src/netx/capability-groups.ts
var DEFAULT_CAPABILITY_GROUPS = Object.freeze({
  ops: Object.freeze({ inPreset: true, public: false }),
  topology: Object.freeze({ inPreset: false, public: false })
});
var TOOLS_BY_GROUP = Object.freeze({
  ops: Object.freeze([
    "netx__queryNmsAlarms",
    "netx__aggregateNmsAlarms",
    "netx__runNmsDiagnostics",
    "netx__queryNmsNeInventory",
    "netx__getNmsNe",
    "netx__queryNmsAlarmsRaw",
    "netx__aggregateNmsAlarmsRaw",
    "netx__listNmsAlarmFields",
    "netx__sqlQueryNms",
    "netx__listManagedNe",
    "netx__getManagedNe",
    "netx__execManagedNe",
    "netx__listCliTargets",
    "netx__findTopologyPaths"
  ]),
  topology: Object.freeze([
    "netx__getTopologyTree",
    "netx__getTopologyView",
    "netx__createTopologyFolder",
    "netx__addTopologyViewNodes",
    "netx__removeTopologyViewNodes",
    "netx__copyTopologyViewNodes",
    "netx__updateTopologyViewPositions",
    "netx__projectTopologyNeighbors",
    "netx__queryTopologyFabricNodes",
    "netx__classifyTopologyFabricNodes",
    "netx__queryTopologyNeighborhood",
    "netx__queryTopologyEdges",
    "netx__layoutTopologyView",
    "netx__suggestSinkHubs",
    "netx__analyzeTopologyViewLayout",
    "netx__sinkTopologyDualUnits"
  ])
});
var SKILL_DIR_BY_GROUP = Object.freeze({
  ops: "ops",
  topology: "topology"
});
var CAPABILITY_GROUP_IDS = Object.freeze([
  "ops",
  "topology"
]);
function capabilityGroupsFromSettings(fields) {
  const src = fields ?? {};
  let opsInPreset = true;
  if (src.groupOpsInPreset !== undefined) {
    opsInPreset = src.groupOpsInPreset !== false;
  } else {
    const legacy = [
      src.groupNmsInPreset,
      src.groupCommonInPreset,
      src.groupManagedNeInPreset
    ].filter((v) => v !== undefined);
    if (legacy.length > 0) {
      opsInPreset = legacy.some((v) => v === true);
    }
  }
  return {
    ops: {
      inPreset: opsInPreset,
      public: src.groupOpsPublic === true || src.groupNmsPublic === true || src.groupCommonPublic === true || src.groupManagedNePublic === true
    },
    topology: {
      inPreset: src.groupTopologyInPreset === true || src.groupTopologyLayoutInPreset === true,
      public: src.groupTopologyPublic === true || src.groupTopologyLayoutPublic === true
    }
  };
}
function groupsForPlane(groups, plane, only) {
  const policy = groups ?? DEFAULT_CAPABILITY_GROUPS;
  const enabled = CAPABILITY_GROUP_IDS.filter((id) => plane === "preset" ? policy[id].inPreset : policy[id].public);
  if (!only || only.length === 0)
    return enabled;
  const allow = new Set(only);
  return enabled.filter((id) => allow.has(id));
}
function toolNamesForGroups(groupIds) {
  const names = new Set;
  for (const id of groupIds) {
    for (const tool of TOOLS_BY_GROUP[id])
      names.add(tool);
  }
  return names;
}

// src/netx/group-skills.ts
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join as join2 } from "node:path";
import { fileURLToPath } from "node:url";
function opsSkillsRoot() {
  const envRoot = process.env.NETX_SKILLS_ROOT?.trim();
  if (envRoot && existsSync(envRoot))
    return envRoot;
  const here = dirname(fileURLToPath(import.meta.url));
  const siblingCandidates = [
    join2(here, "..", "..", "..", "netx", "skills"),
    join2(here, "..", "..", "netx", "skills")
  ];
  for (const candidate of siblingCandidates) {
    if (existsSync(candidate))
      return candidate;
  }
  const packaged = [
    join2(here, "..", "presets", "netxops", "skills"),
    join2(here, "..", "..", "presets", "netxops", "skills")
  ];
  for (const candidate of packaged) {
    if (existsSync(candidate))
      return candidate;
  }
  return packaged[0];
}
function parseFrontmatter(raw) {
  if (!raw.startsWith("---"))
    return;
  const end = raw.indexOf(`
---`, 3);
  if (end < 0)
    return;
  const yaml = raw.slice(3, end).replace(/^\r?\n/, "");
  const body = raw.slice(end + 4).replace(/^\r?\n/, "");
  const data = {};
  const lines = yaml.split(/\r?\n/);
  for (let i = 0;i < lines.length; i += 1) {
    const line = lines[i];
    const nameMatch = /^name\s*:\s*(.+)\s*$/.exec(line);
    if (nameMatch) {
      data.name = stripQuotes(nameMatch[1].trim());
      continue;
    }
    const descMatch = /^description\s*:\s*(.*)$/.exec(line);
    if (!descMatch)
      continue;
    const head = descMatch[1].trim();
    if (head === ">" || head === ">-" || head === "|" || head === "|-") {
      const parts = [];
      while (i + 1 < lines.length && /^[ \t]+/.test(lines[i + 1])) {
        i += 1;
        parts.push(lines[i].trim());
      }
      data.description = parts.filter(Boolean).join(" ");
      continue;
    }
    data.description = stripQuotes(head);
  }
  return { data, body };
}
function stripQuotes(value) {
  if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
}
async function loadSkillBundle(dir) {
  const skillPath = join2(dir, "SKILL.md");
  let raw;
  try {
    raw = await readFile(skillPath, "utf8");
  } catch {
    return null;
  }
  const parsed = parseFrontmatter(raw);
  if (!parsed)
    return null;
  const name = typeof parsed.data.name === "string" ? parsed.data.name.trim() : "";
  const description = typeof parsed.data.description === "string" ? parsed.data.description.trim() : "";
  if (!name || !description)
    return null;
  return {
    name,
    description,
    content: parsed.body.trimStart(),
    path: skillPath,
    directory: dir
  };
}
async function loadGroupSkills(skillsRoot, groupId) {
  const groupDir = join2(skillsRoot, SKILL_DIR_BY_GROUP[groupId]);
  let entries;
  try {
    entries = await readdir(groupDir);
  } catch {
    return [];
  }
  const skills = [];
  for (const entry of entries) {
    const full = join2(groupDir, entry);
    let isDir = false;
    try {
      isDir = (await stat(full)).isDirectory();
    } catch {
      continue;
    }
    if (!isDir)
      continue;
    const skill = await loadSkillBundle(full);
    if (skill)
      skills.push(skill);
  }
  return skills;
}
async function registerGroupSkills(ctx, groupIds, providerLabel) {
  const skillsApi = ctx.skills;
  if (!skillsApi || typeof skillsApi.register !== "function") {
    return () => {};
  }
  const root = opsSkillsRoot();
  const disposers = [];
  const enabled = new Set(groupIds);
  for (const groupId of CAPABILITY_GROUP_IDS) {
    if (!enabled.has(groupId))
      continue;
    const skills = await loadGroupSkills(root, groupId);
    for (const skill of skills) {
      disposers.push(skillsApi.register({
        name: skill.name,
        description: skill.description,
        content: skill.content,
        path: skill.path,
        resourceBase: { kind: "directory", path: skill.directory },
        provider: providerLabel,
        source: "custom"
      }));
    }
  }
  return () => {
    for (const dispose of disposers)
      dispose();
  };
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
function getNetxConnection() {
  return store2().connection;
}
function watchNetxConnection(listener) {
  const state = store2();
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

// src/netx/session-export.ts
import { homedir as homedir2, hostname as osHostname } from "node:os";

// node_modules/fflate/esm/index.mjs
import { createRequire as createRequire2 } from "module";
var require2 = createRequire2("/");
var _a;
var Worker;
var isMarkedAsUntransferable;
try {
  _a = require2("worker_threads"), Worker = _a.Worker, isMarkedAsUntransferable = _a.isMarkedAsUntransferable;
} catch (e) {}
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0]);
var fdeb = new u8([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 0, 0]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b = new u16(31);
  for (var i = 0;i < 31; ++i) {
    b[i] = start += 1 << eb[i - 1];
  }
  var r = new i32(b[30]);
  for (var i = 1;i < 30; ++i) {
    for (var j = b[i];j < b[i + 1]; ++j) {
      r[j] = j - b[i] << 5 | i;
    }
  }
  return { b, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0;i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = function(cd, mb, r) {
  var s = cd.length;
  var i2 = 0;
  var l = new u16(mb);
  for (;i2 < s; ++i2) {
    if (cd[i2])
      ++l[cd[i2] - 1];
  }
  var le = new u16(mb);
  for (i2 = 1;i2 < mb; ++i2) {
    le[i2] = le[i2 - 1] + l[i2 - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i2 = 0;i2 < s; ++i2) {
      if (cd[i2]) {
        var sv = i2 << 4 | cd[i2];
        var r_1 = mb - cd[i2];
        var v = le[cd[i2] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1;v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i2 = 0;i2 < s; ++i2) {
      if (cd[i2]) {
        co[i2] = rev[le[cd[i2] - 1]++] >> 15 - cd[i2];
      }
    }
  }
  return co;
};
var flt = new u8(288);
for (i = 0;i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144;i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256;i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280;i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0;i < 32; ++i)
  fdt[i] = 5;
var i;
var flm = /* @__PURE__ */ hMap(flt, 9, 0);
var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var wbits = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
};
var wbits16 = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
  d[o + 2] |= v >> 16;
};
var hTree = function(d, mb) {
  var t = [];
  for (var i2 = 0;i2 < d.length; ++i2) {
    if (d[i2])
      t.push({ s: i2, f: d[i2] });
  }
  var s = t.length;
  var t2 = t.slice();
  if (!s)
    return { t: et, l: 0 };
  if (s == 1) {
    var v = new u8(t[0].s + 1);
    v[t[0].s] = 1;
    return { t: v, l: 1 };
  }
  t.sort(function(a, b) {
    return a.f - b.f;
  });
  t.push({ s: -1, f: 25001 });
  var l = t[0], r = t[1], i0 = 0, i1 = 1, i22 = 2;
  t[0] = { s: -1, f: l.f + r.f, l, r };
  while (i1 != s - 1) {
    l = t[t[i0].f < t[i22].f ? i0++ : i22++];
    r = t[i0 != i1 && t[i0].f < t[i22].f ? i0++ : i22++];
    t[i1++] = { s: -1, f: l.f + r.f, l, r };
  }
  var maxSym = t2[0].s;
  for (var i2 = 1;i2 < s; ++i2) {
    if (t2[i2].s > maxSym)
      maxSym = t2[i2].s;
  }
  var tr = new u16(maxSym + 1);
  var mbt = ln(t[i1 - 1], tr, 0);
  if (mbt > mb) {
    var i2 = 0, dt = 0;
    var lft = mbt - mb, cst = 1 << lft;
    t2.sort(function(a, b) {
      return tr[b.s] - tr[a.s] || a.f - b.f;
    });
    for (;i2 < s; ++i2) {
      var i2_1 = t2[i2].s;
      if (tr[i2_1] > mb) {
        dt += cst - (1 << mbt - tr[i2_1]);
        tr[i2_1] = mb;
      } else
        break;
    }
    dt >>= lft;
    while (dt > 0) {
      var i2_2 = t2[i2].s;
      if (tr[i2_2] < mb)
        dt -= 1 << mb - tr[i2_2]++ - 1;
      else
        ++i2;
    }
    for (;i2 >= 0 && dt; --i2) {
      var i2_3 = t2[i2].s;
      if (tr[i2_3] == mb) {
        --tr[i2_3];
        ++dt;
      }
    }
    mbt = mb;
  }
  return { t: new u8(tr), l: mbt };
};
var ln = function(n, l, d) {
  return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
};
var lc = function(c) {
  var s = c.length;
  while (s && !c[--s])
    ;
  var cl = new u16(++s);
  var cli = 0, cln = c[0], cls = 1;
  var w = function(v) {
    cl[cli++] = v;
  };
  for (var i2 = 1;i2 <= s; ++i2) {
    if (c[i2] == cln && i2 != s)
      ++cls;
    else {
      if (!cln && cls > 2) {
        for (;cls > 138; cls -= 138)
          w(32754);
        if (cls > 2) {
          w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
          cls = 0;
        }
      } else if (cls > 3) {
        w(cln), --cls;
        for (;cls > 6; cls -= 6)
          w(8304);
        if (cls > 2)
          w(cls - 3 << 5 | 8208), cls = 0;
      }
      while (cls--)
        w(cln);
      cls = 1;
      cln = c[i2];
    }
  }
  return { c: cl.subarray(0, cli), n: s };
};
var clen = function(cf, cl) {
  var l = 0;
  for (var i2 = 0;i2 < cl.length; ++i2)
    l += cf[i2] * cl[i2];
  return l;
};
var wfblk = function(out, pos, dat) {
  var s = dat.length;
  var o = shft(pos + 2);
  out[o] = s & 255;
  out[o + 1] = s >> 8;
  out[o + 2] = out[o] ^ 255;
  out[o + 3] = out[o + 1] ^ 255;
  for (var i2 = 0;i2 < s; ++i2)
    out[o + i2 + 4] = dat[i2];
  return (o + 4 + s) * 8;
};
var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
  wbits(out, p++, final);
  ++lf[256];
  var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
  var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
  var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
  var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
  var lcfreq = new u16(19);
  for (var i2 = 0;i2 < lclt.length; ++i2)
    ++lcfreq[lclt[i2] & 31];
  for (var i2 = 0;i2 < lcdt.length; ++i2)
    ++lcfreq[lcdt[i2] & 31];
  var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
  var nlcc = 19;
  for (;nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
    ;
  var flen = bl + 5 << 3;
  var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
  var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
  if (bs >= 0 && flen <= ftlen && flen <= dtlen)
    return wfblk(out, p, dat.subarray(bs, bs + bl));
  var lm, ll, dm, dl;
  wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
  if (dtlen < ftlen) {
    lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
    var llm = hMap(lct, mlcb, 0);
    wbits(out, p, nlc - 257);
    wbits(out, p + 5, ndc - 1);
    wbits(out, p + 10, nlcc - 4);
    p += 14;
    for (var i2 = 0;i2 < nlcc; ++i2)
      wbits(out, p + 3 * i2, lct[clim[i2]]);
    p += 3 * nlcc;
    var lcts = [lclt, lcdt];
    for (var it = 0;it < 2; ++it) {
      var clct = lcts[it];
      for (var i2 = 0;i2 < clct.length; ++i2) {
        var len = clct[i2] & 31;
        wbits(out, p, llm[len]), p += lct[len];
        if (len > 15)
          wbits(out, p, clct[i2] >> 5 & 127), p += clct[i2] >> 12;
      }
    }
  } else {
    lm = flm, ll = flt, dm = fdm, dl = fdt;
  }
  for (var i2 = 0;i2 < li; ++i2) {
    var sym = syms[i2];
    if (sym > 255) {
      var len = sym >> 18 & 31;
      wbits16(out, p, lm[len + 257]), p += ll[len + 257];
      if (len > 7)
        wbits(out, p, sym >> 23 & 31), p += fleb[len];
      var dst = sym & 31;
      wbits16(out, p, dm[dst]), p += dl[dst];
      if (dst > 3)
        wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
    } else {
      wbits16(out, p, lm[sym]), p += ll[sym];
    }
  }
  wbits16(out, p, lm[256]);
  return p + ll[256];
};
var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
var et = /* @__PURE__ */ new u8(0);
var dflt = function(dat, lvl, plvl, pre, post, st) {
  var s = st.z || dat.length;
  var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7000)) + post);
  var w = o.subarray(pre, o.length - post);
  var lst = st.l;
  var pos = (st.r || 0) & 7;
  if (lvl) {
    if (pos)
      w[0] = st.r >> 3;
    var opt = deo[lvl - 1];
    var n = opt >> 13, c = opt & 8191;
    var msk_1 = (1 << plvl) - 1;
    var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
    var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
    var hsh = function(i3) {
      return (dat[i3] ^ dat[i3 + 1] << bs1_1 ^ dat[i3 + 2] << bs2_1) & msk_1;
    };
    var syms = new i32(25000);
    var lf = new u16(288), df = new u16(32);
    var lc_1 = 0, eb = 0, i2 = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
    for (;i2 + 2 < s; ++i2) {
      var hv = hsh(i2);
      var imod = i2 & 32767, pimod = head[hv];
      prev[imod] = pimod;
      head[hv] = imod;
      if (wi <= i2) {
        var rem = s - i2;
        if ((lc_1 > 7000 || li > 24576) && (rem > 423 || !lst)) {
          pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i2 - bs, pos);
          li = lc_1 = eb = 0, bs = i2;
          for (var j = 0;j < 286; ++j)
            lf[j] = 0;
          for (var j = 0;j < 30; ++j)
            df[j] = 0;
        }
        var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
        if (rem > 2 && hv == hsh(i2 - dif)) {
          var maxn = Math.min(n, rem) - 1;
          var maxd = Math.min(32767, i2);
          var ml = Math.min(258, rem);
          while (dif <= maxd && --ch_1 && imod != pimod) {
            if (dat[i2 + l] == dat[i2 + l - dif]) {
              var nl = 0;
              for (;nl < ml && dat[i2 + nl] == dat[i2 + nl - dif]; ++nl)
                ;
              if (nl > l) {
                l = nl, d = dif;
                if (nl > maxn)
                  break;
                var mmd = Math.min(dif, nl - 2);
                var md = 0;
                for (var j = 0;j < mmd; ++j) {
                  var ti = i2 - dif + j & 32767;
                  var pti = prev[ti];
                  var cd = ti - pti & 32767;
                  if (cd > md)
                    md = cd, pimod = ti;
                }
              }
            }
            imod = pimod, pimod = prev[imod];
            dif += imod - pimod & 32767;
          }
        }
        if (d) {
          syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
          var lin = revfl[l] & 31, din = revfd[d] & 31;
          eb += fleb[lin] + fdeb[din];
          ++lf[257 + lin];
          ++df[din];
          wi = i2 + l;
          ++lc_1;
        } else {
          syms[li++] = dat[i2];
          ++lf[dat[i2]];
        }
      }
    }
    for (i2 = Math.max(i2, wi);i2 < s; ++i2) {
      syms[li++] = dat[i2];
      ++lf[dat[i2]];
    }
    pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i2 - bs, pos);
    if (!lst) {
      st.r = pos & 7 | w[pos / 8 | 0] << 3;
      pos -= 7;
      st.h = head, st.p = prev, st.i = i2, st.w = wi;
    }
  } else {
    for (var i2 = st.w || 0;i2 < s + lst; i2 += 65535) {
      var e = i2 + 65535;
      if (e >= s) {
        w[pos / 8 | 0] = lst;
        e = s;
      }
      pos = wfblk(w, pos + 1, dat.subarray(i2, e));
    }
    st.i = s;
  }
  return slc(o, 0, pre + shft(pos) + post);
};
var crct = /* @__PURE__ */ function() {
  var t = new Int32Array(256);
  for (var i2 = 0;i2 < 256; ++i2) {
    var c = i2, k = 9;
    while (--k)
      c = (c & 1 && -306674912) ^ c >>> 1;
    t[i2] = c;
  }
  return t;
}();
var crc = function() {
  var c = -1;
  return {
    p: function(d) {
      var cr = c;
      for (var i2 = 0;i2 < d.length; ++i2)
        cr = crct[cr & 255 ^ d[i2]] ^ cr >>> 8;
      c = cr;
    },
    d: function() {
      return ~c;
    }
  };
};
var dopt = function(dat, opt, pre, post, st) {
  if (!st) {
    st = { l: 1 };
    if (opt.dictionary) {
      var dict = opt.dictionary.subarray(-32768);
      var newDat = new u8(dict.length + dat.length);
      newDat.set(dict);
      newDat.set(dat, dict.length);
      dat = newDat;
      st.w = dict.length;
    }
  }
  return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
};
var mrg = function(a, b) {
  var o = {};
  for (var k in a)
    o[k] = a[k];
  for (var k in b)
    o[k] = b[k];
  return o;
};
var wbytes = function(d, b, v) {
  for (;v; ++b)
    d[b] = v, v >>>= 8;
};
var Deflate = /* @__PURE__ */ function() {
  function Deflate2(opts, cb) {
    if (typeof opts == "function")
      cb = opts, opts = {};
    this.ondata = cb;
    this.o = opts || {};
    this.s = { l: 0, i: 32768, w: 32768, z: 32768 };
    this.b = new u8(98304);
    if (this.o.dictionary) {
      var dict = this.o.dictionary.subarray(-32768);
      this.b.set(dict, 32768 - dict.length);
      this.s.i = 32768 - dict.length;
    }
  }
  Deflate2.prototype.p = function(c, f) {
    this.ondata(dopt(c, this.o, 0, 0, this.s), f);
  };
  Deflate2.prototype.push = function(chunk, final) {
    if (!this.ondata)
      err(5);
    if (this.s.l)
      err(4);
    var endLen = chunk.length + this.s.z;
    if (endLen > this.b.length) {
      if (endLen > 2 * this.b.length - 32768) {
        var newBuf = new u8(endLen & -32768);
        newBuf.set(this.b.subarray(0, this.s.z));
        this.b = newBuf;
      }
      var split = this.b.length - this.s.z;
      this.b.set(chunk.subarray(0, split), this.s.z);
      this.s.z = this.b.length;
      this.p(this.b, false);
      this.b.set(this.b.subarray(-32768));
      this.b.set(chunk.subarray(split), 32768);
      this.s.z = chunk.length - split + 32768;
      this.s.i = 32766, this.s.w = 32768;
    } else {
      this.b.set(chunk, this.s.z);
      this.s.z += chunk.length;
    }
    this.s.l = final & 1;
    if (this.s.z > this.s.w + 8191 || final) {
      this.p(this.b, final || false);
      this.s.w = this.s.i, this.s.i -= 2;
    }
    if (final) {
      this.s = this.o = {};
      this.b = et;
    }
  };
  Deflate2.prototype.flush = function(sync) {
    if (!this.ondata)
      err(5);
    if (this.s.l)
      err(4);
    this.p(this.b, false);
    this.s.w = this.s.i, this.s.i -= 2;
    if (sync) {
      var c = new u8(6);
      c[0] = this.s.r >> 3;
      var ep = wfblk(c, this.s.r, et);
      this.s.r = 0;
      this.ondata(c.subarray(0, ep >> 3), false);
    }
  };
  return Deflate2;
}();
var te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder;
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder;
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {}
function strToU8(str, latin1) {
  if (latin1) {
    var ar_1 = new u8(str.length);
    for (var i2 = 0;i2 < str.length; ++i2)
      ar_1[i2] = str.charCodeAt(i2);
    return ar_1;
  }
  if (te)
    return te.encode(str);
  var l = str.length;
  var ar = new u8(str.length + (str.length >> 1));
  var ai = 0;
  var w = function(v) {
    ar[ai++] = v;
  };
  for (var i2 = 0;i2 < l; ++i2) {
    if (ai + 5 > ar.length) {
      var n = new u8(ai + 8 + (l - i2 << 1));
      n.set(ar);
      ar = n;
    }
    var c = str.charCodeAt(i2);
    if (c < 128 || latin1)
      w(c);
    else if (c < 2048)
      w(192 | c >> 6), w(128 | c & 63);
    else if (c > 55295 && c < 57344)
      c = 65536 + (c & 1023 << 10) | str.charCodeAt(++i2) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
    else
      w(224 | c >> 12), w(128 | c >> 6 & 63), w(128 | c & 63);
  }
  return slc(ar, 0, ai);
}
var dbf = function(l) {
  return l == 1 ? 3 : l < 6 ? 2 : l == 9 ? 1 : 0;
};
var exfl = function(ex) {
  var le = 0;
  if (ex) {
    for (var k in ex) {
      var l = ex[k].length;
      if (l > 65535)
        err(9);
      le += l + 4;
    }
  }
  return le;
};
var wzh = function(d, b, f, fn, u, c, ce, co) {
  var fl2 = fn.length, ex = f.extra, col = co && co.length;
  var exl = exfl(ex);
  wbytes(d, b, ce != null ? 33639248 : 67324752), b += 4;
  if (ce != null)
    d[b++] = 20, d[b++] = f.os;
  d[b] = 20, b += 2;
  d[b++] = f.flag << 1 | (c < 0 && 8), d[b++] = u && 8;
  d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
  var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
  if (y < 0 || y > 119)
    err(10);
  wbytes(d, b, y << 25 | dt.getMonth() + 1 << 21 | dt.getDate() << 16 | dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1), b += 4;
  if (c != -1) {
    wbytes(d, b, f.crc);
    wbytes(d, b + 4, c < 0 ? -c - 2 : c);
    wbytes(d, b + 8, f.size);
  }
  wbytes(d, b + 12, fl2);
  wbytes(d, b + 14, exl), b += 16;
  if (ce != null) {
    wbytes(d, b, col);
    wbytes(d, b + 6, f.attrs);
    wbytes(d, b + 10, ce), b += 14;
  }
  d.set(fn, b);
  b += fl2;
  if (exl) {
    for (var k in ex) {
      var exf = ex[k], l = exf.length;
      wbytes(d, b, +k);
      wbytes(d, b + 2, l);
      d.set(exf, b + 4), b += 4 + l;
    }
  }
  if (col)
    d.set(co, b), b += col;
  return b;
};
var wzf = function(o, b, c, d, e) {
  wbytes(o, b, 101010256);
  wbytes(o, b + 8, c);
  wbytes(o, b + 10, c);
  wbytes(o, b + 12, d);
  wbytes(o, b + 16, e);
};
var ZipPassThrough = /* @__PURE__ */ function() {
  function ZipPassThrough2(filename) {
    this.filename = filename;
    this.c = crc();
    this.size = 0;
    this.compression = 0;
  }
  ZipPassThrough2.prototype.process = function(chunk, final) {
    this.ondata(null, chunk, final);
  };
  ZipPassThrough2.prototype.push = function(chunk, final) {
    if (!this.ondata)
      err(5);
    this.c.p(chunk);
    this.size += chunk.length;
    if (final)
      this.crc = this.c.d();
    this.process(chunk, final || false);
  };
  return ZipPassThrough2;
}();
var ZipDeflate = /* @__PURE__ */ function() {
  function ZipDeflate2(filename, opts) {
    var _this = this;
    if (!opts)
      opts = {};
    ZipPassThrough.call(this, filename);
    this.d = new Deflate(opts, function(dat, final) {
      _this.ondata(null, dat, final);
    });
    this.compression = 8;
    this.flag = dbf(opts.level);
  }
  ZipDeflate2.prototype.process = function(chunk, final) {
    try {
      this.d.push(chunk, final);
    } catch (e) {
      this.ondata(e, null, final);
    }
  };
  ZipDeflate2.prototype.push = function(chunk, final) {
    ZipPassThrough.prototype.push.call(this, chunk, final);
  };
  return ZipDeflate2;
}();
var Zip = /* @__PURE__ */ function() {
  function Zip2(cb) {
    this.ondata = cb;
    this.u = [];
    this.d = 1;
  }
  Zip2.prototype.add = function(file) {
    var _this = this;
    if (!this.ondata)
      err(5);
    if (this.d & 2)
      this.ondata(err(4 + (this.d & 1) * 8, 0, 1), null, false);
    else {
      var f = strToU8(file.filename), fl_1 = f.length;
      var com = file.comment, o = com && strToU8(com);
      var u = fl_1 != file.filename.length || o && com.length != o.length;
      var hl_1 = fl_1 + exfl(file.extra) + 30;
      if (fl_1 > 65535)
        this.ondata(err(11, 0, 1), null, false);
      var header = new u8(hl_1);
      wzh(header, 0, file, f, u, -1);
      var chks_1 = [header];
      var pAll_1 = function() {
        for (var _i = 0, chks_2 = chks_1;_i < chks_2.length; _i++) {
          var chk = chks_2[_i];
          _this.ondata(null, chk, false);
        }
        chks_1 = [];
      };
      var tr_1 = this.d;
      this.d = 0;
      var ind_1 = this.u.length;
      var uf_1 = mrg(file, {
        f,
        u,
        o,
        t: function() {
          if (file.terminate)
            file.terminate();
        },
        r: function() {
          pAll_1();
          if (tr_1) {
            var nxt = _this.u[ind_1 + 1];
            if (nxt)
              nxt.r();
            else
              _this.d = 1;
          }
          tr_1 = 1;
        }
      });
      var cl_1 = 0;
      file.ondata = function(err2, dat, final) {
        if (err2) {
          _this.ondata(err2, dat, final);
          _this.terminate();
        } else {
          cl_1 += dat.length;
          chks_1.push(dat);
          if (final) {
            var dd = new u8(16);
            wbytes(dd, 0, 134695760);
            wbytes(dd, 4, file.crc);
            wbytes(dd, 8, cl_1);
            wbytes(dd, 12, file.size);
            chks_1.push(dd);
            uf_1.c = cl_1, uf_1.b = hl_1 + cl_1 + 16, uf_1.crc = file.crc, uf_1.size = file.size;
            if (tr_1)
              uf_1.r();
            tr_1 = 1;
          } else if (tr_1)
            pAll_1();
        }
      };
      this.u.push(uf_1);
    }
  };
  Zip2.prototype.end = function() {
    var _this = this;
    if (this.d & 2) {
      this.ondata(err(4 + (this.d & 1) * 8, 0, 1), null, true);
      return;
    }
    if (this.d)
      this.e();
    else
      this.u.push({
        r: function() {
          if (!(_this.d & 1))
            return;
          _this.u.splice(-1, 1);
          _this.e();
        },
        t: function() {}
      });
    this.d = 3;
  };
  Zip2.prototype.e = function() {
    var bt = 0, l = 0, tl = 0;
    for (var _i = 0, _a2 = this.u;_i < _a2.length; _i++) {
      var f = _a2[_i];
      tl += 46 + f.f.length + exfl(f.extra) + (f.o ? f.o.length : 0);
    }
    var out = new u8(tl + 22);
    for (var _b2 = 0, _c = this.u;_b2 < _c.length; _b2++) {
      var f = _c[_b2];
      wzh(out, bt, f, f.f, f.u, -f.c - 2, l, f.o);
      bt += 46 + f.f.length + exfl(f.extra) + (f.o ? f.o.length : 0), l += f.b;
    }
    wzf(out, bt, this.u.length, tl, l);
    this.ondata(null, out, true);
    this.d = 2;
  };
  Zip2.prototype.terminate = function() {
    for (var _i = 0, _a2 = this.u;_i < _a2.length; _i++) {
      var f = _a2[_i];
      f.t();
    }
    this.d = 2;
  };
  return Zip2;
}();

// src/session-export-shared.ts
var NETXOPS_SESSIONS_EXPORT_PATH = "/api/netxops.sessions.export";

// src/netx/session-export.ts
var COMPRESSION_LEVEL = 6;
var PUSH_CHUNK_CODE_UNITS = 1 << 16;
function resolveSessionPersistence(ctx) {
  const fromGet = typeof ctx.get === "function" ? ctx.get("sessionPersistence") : undefined;
  const persistence = fromGet ?? ctx.sessionPersistence;
  if (!persistence || typeof persistence.list !== "function" || typeof persistence.readRaw !== "function") {
    return;
  }
  return persistence;
}
function resolveSessionStore(ctx) {
  const fromGet = typeof ctx.get === "function" ? ctx.get("sessions") : undefined;
  const sessions = fromGet ?? ctx.sessions;
  if (!sessions || typeof sessions.get !== "function" || typeof sessions.flush !== "function") {
    return;
  }
  return sessions;
}
async function getSessionsExportStatus(ctx, signal) {
  const persistence = resolveSessionPersistence(ctx);
  if (!persistence) {
    return {
      available: false,
      sessionCount: 0,
      supportsRawArtifacts: false,
      reason: "sessionPersistence unavailable — mount a JSONL session backend (web profile default)"
    };
  }
  if (!persistence.supportsRawArtifacts) {
    return {
      available: false,
      sessionCount: 0,
      supportsRawArtifacts: false,
      reason: "persistence backend does not expose per-session raw artifacts (SQLite export unsupported)"
    };
  }
  try {
    const headers = await persistence.list(signal);
    signal?.throwIfAborted();
    return {
      available: true,
      sessionCount: headers.length,
      supportsRawArtifacts: true
    };
  } catch (error) {
    return {
      available: false,
      sessionCount: 0,
      supportsRawArtifacts: true,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}
function safePathSegment(id) {
  const base = String(id || "").replace(/\\/g, "/").split("/").pop() ?? "";
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "");
  return cleaned || "unnamed";
}
function sessionsExportZipFilename(exportedAt = new Date, host = osHostname()) {
  const stamp = [
    exportedAt.getUTCFullYear(),
    String(exportedAt.getUTCMonth() + 1).padStart(2, "0"),
    String(exportedAt.getUTCDate()).padStart(2, "0"),
    "-",
    String(exportedAt.getUTCHours()).padStart(2, "0"),
    String(exportedAt.getUTCMinutes()).padStart(2, "0"),
    String(exportedAt.getUTCSeconds()).padStart(2, "0")
  ].join("");
  return `dsh-sessions-${safePathSegment(host)}-${stamp}.zip`;
}
async function flushLiveSession(sessions, id, signal) {
  signal?.throwIfAborted();
  if (!sessions?.get || !sessions.flush)
    return;
  const live = sessions.get(id);
  if (live === undefined || live === null)
    return;
  await sessions.flush(live);
  signal?.throwIfAborted();
}
async function* sessionsExportEntries(ctx, signal) {
  const persistence = resolveSessionPersistence(ctx);
  if (!persistence) {
    throw new Error("sessionPersistence unavailable");
  }
  if (!persistence.supportsRawArtifacts) {
    throw new Error("persistence backend does not expose per-session raw artifacts");
  }
  const sessions = resolveSessionStore(ctx);
  const headers = await persistence.list(signal);
  signal?.throwIfAborted();
  const exportedAt = new Date().toISOString();
  const host = osHostname();
  const included = [];
  const skipped = [];
  const artifactEntries = [];
  for (const header of headers) {
    signal?.throwIfAborted();
    const id = String(header.id);
    try {
      await flushLiveSession(sessions, id, signal);
      const raw = await persistence.readRaw(id, signal);
      signal?.throwIfAborted();
      if (raw === undefined) {
        skipped.push({ id, reason: "no stored artifact" });
        continue;
      }
      const filename = safePathSegment(raw.filename && raw.filename.length > 0 ? raw.filename : "session.jsonl") || "session.jsonl";
      const path = `sessions/${safePathSegment(id)}/${filename}`;
      artifactEntries.push({ path, content: raw.content });
      included.push({
        id,
        path,
        createdAt: header.createdAt,
        cwd: header.cwd,
        agentPreset: header.agentPreset,
        parentSession: header.parentSession !== undefined ? String(header.parentSession) : undefined,
        origin: header.origin
      });
    } catch (error) {
      skipped.push({
        id,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  }
  const manifest = {
    kind: "dsh-netxops-sessions-export",
    version: 1,
    exportedAt,
    hostname: host,
    sessionCountListed: headers.length,
    sessionCountIncluded: included.length,
    sessionCountSkipped: skipped.length,
    sessions: included,
    skipped
  };
  yield {
    path: "manifest.json",
    content: `${JSON.stringify(manifest, null, 2)}
`
  };
  for (const entry of artifactEntries) {
    signal?.throwIfAborted();
    yield entry;
  }
}
async function pushArtifactChunks(deflate, content, signal) {
  const encoder = new TextEncoder;
  let offset = 0;
  let finalChunk;
  do {
    signal.throwIfAborted();
    let end = Math.min(offset + PUSH_CHUNK_CODE_UNITS, content.length);
    if (end < content.length && end - offset > 1) {
      const last = content.charCodeAt(end - 1);
      if (last >= 55296 && last <= 56319)
        end -= 1;
    }
    finalChunk = end >= content.length;
    deflate.push(encoder.encode(content.slice(offset, end)), finalChunk);
    offset = end;
  } while (!finalChunk);
}
function streamSessionsExportZip(ctx, signal) {
  const consumerAbort = new AbortController;
  const producerSignal = AbortSignal.any([signal, consumerAbort.signal]);
  let zip;
  let zipTerminated = false;
  const terminateZip = () => {
    if (zip === undefined || zipTerminated)
      return;
    zipTerminated = true;
    zip.terminate();
  };
  return new ReadableStream({
    start(controller) {
      const archive = new Zip((error, data, final) => {
        if (error) {
          controller.error(error);
          return;
        }
        if (data.byteLength > 0)
          controller.enqueue(data);
        if (final)
          controller.close();
      });
      zip = archive;
      (async () => {
        try {
          for await (const entry of sessionsExportEntries(ctx, producerSignal)) {
            const deflate = new ZipDeflate(entry.path, { level: COMPRESSION_LEVEL });
            archive.add(deflate);
            await pushArtifactChunks(deflate, entry.content, producerSignal);
          }
          archive.end();
        } catch (error) {
          terminateZip();
          controller.error(error instanceof Error ? error : new Error(String(error)));
        }
      })();
    },
    cancel(reason) {
      consumerAbort.abort(reason instanceof Error ? reason : new Error("sessions export stream cancelled"));
      terminateZip();
    }
  });
}
async function sessionsExportResponse(ctx, request) {
  const status = await getSessionsExportStatus(ctx, request.signal);
  if (!status.available) {
    return new Response(status.reason ?? "sessions export unavailable", {
      status: status.supportsRawArtifacts === false && status.reason?.includes("raw artifacts") ? 501 : 500
    });
  }
  const filename = sessionsExportZipFilename();
  const body = streamSessionsExportZip(ctx, request.signal);
  return new Response(body, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
      "x-netxops-session-count": String(status.sessionCount)
    }
  });
}
async function sessionsExportHeadResponse(ctx, request) {
  const status = await getSessionsExportStatus(ctx, request.signal);
  if (!status.available) {
    return new Response(null, {
      status: status.supportsRawArtifacts === false && status.reason?.includes("raw artifacts") ? 501 : 500,
      headers: {
        "x-netxops-export-error": status.reason ?? "sessions export unavailable"
      }
    });
  }
  const filename = sessionsExportZipFilename();
  return new Response(null, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
      "x-netxops-session-count": String(status.sessionCount)
    }
  });
}

// src/netx/tools.ts
import { defineTool } from "@deepseek-ai/dsh-tools";

// src/netx/http.ts
var PROTOCOL_KEY_ZH_TO_EN = {
  其他: "Other",
  时钟: "Clock",
  "OTN/光": "OTN/Optical",
  电源: "Power"
};
function localizePayload(lang, data) {
  if (!lang.trim().toLowerCase().startsWith("en"))
    return data;
  const proto = data.protocol_summary;
  if (!Array.isArray(proto))
    return data;
  for (const row of proto) {
    if (typeof row !== "object" || row === null || Array.isArray(row))
      continue;
    const rec = row;
    const key = typeof rec.key === "string" ? rec.key : "";
    const mapped = PROTOCOL_KEY_ZH_TO_EN[key];
    if (mapped !== undefined)
      rec.key = mapped;
  }
  return data;
}
function encodeQuery(params) {
  const sp = new URLSearchParams;
  for (const [key, value] of Object.entries(params)) {
    sp.set(key, String(value));
  }
  const q = sp.toString();
  return q.length > 0 ? `?${q}` : "";
}
function createNetxClient(connection) {
  const base = connection.apiUrl.replace(/\/$/, "");
  const langParams = () => {
    const lang = connection.lang.trim().toLowerCase();
    if (lang.startsWith("en"))
      return { lang: "en" };
    return {};
  };
  async function request(method, path, options = {}) {
    const token = connection.getToken().trim();
    if (token.length === 0) {
      return {
        ok: false,
        error: "netx_token_missing",
        detail: "Set credential NETX_API_TOKEN (Plugins → Netx Ops or scripts/set-netx-token)."
      };
    }
    const merged = { ...langParams(), ...options.params };
    const url = `${base}${path}${encodeQuery(merged)}`;
    const timeoutMs = options.timeoutMs ?? connection.timeoutMs;
    const controller = new AbortController;
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    const onOuterAbort = () => {
      controller.abort();
    };
    options.signal?.addEventListener("abort", onOuterAbort, { once: true });
    try {
      const headers = {
        accept: "application/json",
        authorization: `Bearer ${token}`
      };
      if (options.body !== undefined)
        headers["content-type"] = "application/json";
      const init = {
        method,
        headers,
        signal: controller.signal
      };
      if (options.body !== undefined)
        init.body = JSON.stringify(options.body);
      const resp = await fetch(url, init);
      const text = await resp.text();
      if (!resp.ok) {
        return { ok: false, error: `netx_http_${resp.status}`, detail: text.slice(0, 800) };
      }
      const data = text.length > 0 ? JSON.parse(text) : {};
      if (typeof data === "object" && data !== null && !Array.isArray(data)) {
        return { ok: true, data: localizePayload(connection.lang, data) };
      }
      return { ok: true, data: { raw: data } };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return { ok: false, error: "netx_request_failed", detail: detail.slice(0, 800) };
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onOuterAbort);
    }
  }
  return {
    get(path, params, signal, timeoutMs) {
      return request("GET", path, { params, signal, timeoutMs });
    },
    post(path, body, signal, timeoutMs) {
      return request("POST", path, { body, signal, timeoutMs });
    },
    patch(path, body, signal, timeoutMs) {
      return request("PATCH", path, { body, signal, timeoutMs });
    }
  };
}
function quoteNeId(neId) {
  return encodeURIComponent(neId.trim());
}

// src/netx/handlers.ts
var EXEC_MAX_COMMANDS = 5;
var UME_RAW_FIELD_PRESETS = {
  brief: [
    "alarm_alarm_key",
    "alarm_host_name",
    "alarm_perceived_severity",
    "alarm_event_type",
    "alarm_last_seen_at",
    "ne_host_name",
    "ne_user_label",
    "ne_ne_name",
    "ne_ip_address",
    "ne_exists"
  ],
  evidence: [
    "alarm_alarm_key",
    "alarm_host_name",
    "alarm_object_name",
    "alarm_event_type",
    "alarm_native_probable_cause",
    "alarm_perceived_severity",
    "alarm_is_cleared",
    "alarm_time_created",
    "alarm_last_seen_at",
    "ne_host_name",
    "ne_user_label",
    "ne_ne_name",
    "ne_ip_address",
    "ne_connection_status",
    "ne_exists"
  ],
  ne_debug: [
    "alarm_alarm_key",
    "alarm_ne_id",
    "alarm_perceived_severity",
    "alarm_last_seen_at",
    "ne_user_label",
    "ne_ne_name",
    "ne_ip_address",
    "ne_ipv6_address",
    "ne_device_level",
    "ne_host_name",
    "ne_connection_status",
    "ne_admin_status",
    "ne_address_type",
    "ne_maintain_status",
    "ne_exists"
  ]
};
function asRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}
function str(args, key, fallback = "") {
  const v = args[key];
  if (typeof v === "string")
    return v;
  if (typeof v === "number" || typeof v === "boolean")
    return String(v);
  return fallback;
}
function nmsOrUme(args, nmsKey, umeKey) {
  return str(args, nmsKey).trim() || str(args, umeKey).trim();
}
function nmsOrUmeList(args, nmsKey, umeKey) {
  const primary = strList(args, nmsKey);
  return primary.length > 0 ? primary : strList(args, umeKey);
}
function num(args, key) {
  const v = args[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function bool(args, key) {
  const v = args[key];
  return typeof v === "boolean" ? v : undefined;
}
function strList(args, key) {
  const v = args[key];
  if (!Array.isArray(v))
    return [];
  return v.map((x2) => String(x2).trim()).filter((x2) => x2.length > 0);
}
function clampInt(value, fallback, min, max) {
  const n = value === undefined ? fallback : Math.trunc(value);
  return Math.max(min, Math.min(max, n));
}
function putStr(params, args, keys) {
  for (const key of keys) {
    const v = str(args, key).trim();
    if (v)
      params[key] = v;
  }
}
async function queryUmeAlarms(client, args, signal) {
  let page = clampInt(num(args, "page"), 1, 1, 2);
  const pageSize = clampInt(num(args, "page_size"), 50, 1, 500);
  const params = { page, page_size: pageSize };
  putStr(params, args, ["severity", "ne_id", "host_name", "time_from", "time_to"]);
  const keyword = str(args, "keyword").trim();
  const neName = str(args, "ne_name").trim();
  if (keyword)
    params.keyword = keyword;
  else if (neName)
    params.keyword = neName;
  return client.get("/v1/ume/alarms", params, signal);
}
async function aggregateUmeAlarmsRaw(client, args, signal) {
  const params = {};
  putStr(params, args, [
    "group_by",
    "group_by2",
    "severity",
    "is_cleared",
    "ne_id",
    "event_type",
    "keyword",
    "time_from",
    "time_to",
    "limit"
  ]);
  if ("exclude_missing_host" in args) {
    const flag = bool(args, "exclude_missing_host");
    if (flag !== undefined)
      params.exclude_missing_host = flag;
  }
  return client.get("/v1/ume/alarms/aggregate/raw", params, signal);
}
async function aggregateUmeAlarms(client, args, signal) {
  if (str(args, "group_by").trim())
    return aggregateUmeAlarmsRaw(client, args, signal);
  const topNe = clampInt(num(args, "top_ne"), 50, 0, 500);
  const params = { top_ne: topNe };
  if ("exclude_missing_host" in args) {
    const flag = bool(args, "exclude_missing_host");
    if (flag !== undefined)
      params.exclude_missing_host = flag;
  }
  putStr(params, args, ["severity", "time_from", "time_to"]);
  return client.get("/v1/ume/alarms/aggregate", params, signal);
}
async function runUmeDiagnostics(client, _args, signal) {
  return client.get("/v1/ume/diagnostics", undefined, signal);
}
async function queryUmeNeInventory(client, args, signal) {
  const params = {
    page: clampInt(num(args, "page"), 1, 1, Number.MAX_SAFE_INTEGER),
    page_size: clampInt(num(args, "page_size"), 50, 1, 500)
  };
  putStr(params, args, ["keyword"]);
  return client.get("/v1/ume/inventory/ne", params, signal);
}
async function getUmeNe(client, args, signal) {
  const neId = str(args, "ne_id").trim();
  if (!neId)
    return { ok: false, error: "ne_id_required", error_code: "ne_id_required" };
  return client.get(`/v1/ume/inventory/ne/${quoteNeId(neId)}`, undefined, signal);
}
async function queryUmeAlarmsRaw(client, args, signal) {
  const params = {
    page: clampInt(num(args, "page"), 1, 1, Number.MAX_SAFE_INTEGER),
    page_size: clampInt(num(args, "page_size"), 50, 1, 500)
  };
  putStr(params, args, [
    "severity",
    "is_cleared",
    "ne_id",
    "event_type",
    "keyword",
    "time_from",
    "time_to",
    "order_by",
    "order"
  ]);
  let fields = strList(args, "select_fields");
  if (fields.length === 0) {
    const preset = str(args, "field_preset").trim().toLowerCase();
    fields = UME_RAW_FIELD_PRESETS[preset] ?? [];
  }
  if (fields.length > 0)
    params.select_fields = fields.join(",");
  return client.get("/v1/ume/alarms/raw", params, signal);
}
async function listUmeAlarmFields(client, _args, signal) {
  return client.get("/v1/ume/alarms/fields", undefined, signal);
}
async function sqlQueryUme(client, args, signal) {
  const sql = str(args, "sql").trim();
  if (!sql)
    return { ok: false, error: "sql_required" };
  const limit = clampInt(num(args, "limit"), 200, 1, 2000);
  const statementTimeoutMs = clampInt(num(args, "statement_timeout_ms"), 0, 0, 30000);
  return client.post("/v1/sql/ume_query", {
    sql,
    limit,
    statement_timeout_ms: statementTimeoutMs
  }, signal, 60000);
}
async function listManagedNe(client, args, signal) {
  const keyword = str(args, "keyword").trim();
  const vendor = str(args, "vendor").trim();
  const connectStatus = str(args, "connect_status").trim();
  if (!(keyword || vendor || connectStatus)) {
    return { ok: false, error: "managed_ne_filter_required", error_code: "managed_ne_filter_required" };
  }
  if (keyword && keyword.length < 2) {
    return { ok: false, error: "managed_ne_keyword_too_short", error_code: "managed_ne_keyword_too_short" };
  }
  const params = {
    page: clampInt(num(args, "page"), 1, 1, Number.MAX_SAFE_INTEGER),
    page_size: clampInt(num(args, "page_size"), 20, 1, 100)
  };
  if (keyword)
    params.keyword = keyword;
  if (vendor)
    params.vendor = vendor;
  if (connectStatus)
    params.connect_status = connectStatus;
  return client.get("/v1/managed-ne", params, signal);
}
async function getManagedNe(client, args, signal) {
  const neId = (str(args, "ne_id") || str(args, "managed_ne_id") || str(args, "id")).trim();
  if (!neId) {
    return {
      ok: false,
      error: "ne_id_required",
      error_code: "ne_id_required",
      hint: "Pass managed NE id from listManagedNe/listCliTargets (source=managed). For NMS inventory UUIDs use execManagedNe(nms_ne_id=...) or getNmsNe, not getManagedNe.",
      example: { ne_id: "<managed-ne-uuid-from-listManagedNe>" }
    };
  }
  const out = await client.get(`/v1/managed-ne/${quoteNeId(neId)}`, undefined, signal);
  if (out.ok === false) {
    const detail = `${str(out, "detail")}${str(out, "error")}`.toLowerCase();
    if (detail.includes("404") || detail.includes("not_found") || detail.includes("not found") || out.error === "netx_http_404") {
      return {
        ...out,
        hint: "Managed NE not found for this ne_id. Call listManagedNe(keyword=...) or listCliTargets(source=managed) first. If this is an NMS inventory id, use execManagedNe(nms_ne_id=...) / getNmsNe instead of getManagedNe."
      };
    }
  }
  return out;
}
async function execManagedNe(client, args, signal) {
  const targetsRaw = args.targets;
  const neIds = strList(args, "ne_ids");
  const umeNeIds = nmsOrUmeList(args, "nms_ne_ids", "ume_ne_ids");
  const sharedCommands = strList(args, "commands");
  const multi = Array.isArray(targetsRaw) && targetsRaw.length > 0 || neIds.length > 0 || umeNeIds.length > 0;
  if (multi) {
    const body2 = {};
    if (Array.isArray(targetsRaw) && targetsRaw.length > 0) {
      const cleaned = [];
      for (const t of targetsRaw) {
        if (typeof t !== "object" || t === null || Array.isArray(t))
          continue;
        const row = t;
        const item = {};
        const neId2 = str(row, "ne_id").trim();
        const umeNeId2 = nmsOrUme(row, "nms_ne_id", "ume_ne_id");
        if (neId2)
          item.ne_id = neId2;
        if (umeNeId2)
          item.ume_ne_id = umeNeId2;
        const cmds = Array.isArray(row.commands) ? row.commands.map((c) => String(c).trim()).filter((c) => c.length > 0) : [];
        if (cmds.length > 0)
          item.commands = cmds;
        if (Object.keys(item).length > 0)
          cleaned.push(item);
      }
      body2.targets = cleaned;
    }
    if (neIds.length > 0)
      body2.ne_ids = neIds;
    if (umeNeIds.length > 0)
      body2.ume_ne_ids = umeNeIds;
    if (sharedCommands.length > 0) {
      if (sharedCommands.length > EXEC_MAX_COMMANDS) {
        return { ok: false, error: "too_many_commands", error_code: "too_many_commands" };
      }
      body2.commands = sharedCommands;
    }
    body2.read_timeout_sec = clampInt(num(args, "read_timeout_sec"), 60, 10, 120);
    const concurrency = num(args, "concurrency");
    if (concurrency !== undefined)
      body2.concurrency = clampInt(concurrency, 4, 1, 8);
    const out2 = await client.post("/v1/managed-ne/exec-batch", body2, signal, 600000);
    if (out2.ok !== true)
      return out2;
    const data2 = asRecord(out2.data);
    if (data2.ok === false) {
      return { ok: false, data: data2, error: str(data2, "error", "exec_batch_failed") };
    }
    return { ok: true, data: data2 };
  }
  const neId = str(args, "ne_id").trim();
  const umeNeId = nmsOrUme(args, "nms_ne_id", "ume_ne_id");
  if (Boolean(neId) === Boolean(umeNeId)) {
    return {
      ok: false,
      error: "exactly_one_of_ne_id_or_nms_ne_id_required",
      error_code: "exactly_one_of_ne_id_or_nms_ne_id_required",
      hint: "For one NE pass ne_id OR nms_ne_id (alias ume_ne_id). For many NEs pass ne_ids / nms_ne_ids with shared commands, or targets[] — one call, concurrent on server."
    };
  }
  if (sharedCommands.length === 0) {
    return { ok: false, error: "commands_required", error_code: "commands_required" };
  }
  if (sharedCommands.length > EXEC_MAX_COMMANDS) {
    return { ok: false, error: "too_many_commands", error_code: "too_many_commands" };
  }
  const body = {
    commands: sharedCommands,
    read_timeout_sec: clampInt(num(args, "read_timeout_sec"), 60, 10, 120)
  };
  if (neId)
    body.ne_id = neId;
  if (umeNeId)
    body.ume_ne_id = umeNeId;
  const out = await client.post("/v1/managed-ne/exec", body, signal, 300000);
  if (out.ok !== true)
    return out;
  const data = asRecord(out.data);
  if (data.ok === false) {
    return { ok: false, data, error: str(data, "error", "exec_failed") };
  }
  return { ok: true, data };
}
async function listCliTargets(client, args, signal) {
  const params = {
    page: clampInt(num(args, "page"), 1, 1, Number.MAX_SAFE_INTEGER),
    page_size: clampInt(num(args, "page_size"), 50, 1, 500)
  };
  putStr(params, args, ["source", "keyword"]);
  return client.get("/v1/cli/targets", params, signal);
}
async function findTopologyPaths(client, args, signal) {
  const fromUid = nmsOrUme(args, "from_nms_ne_id", "from_ume_ne_id");
  const fromMid = str(args, "from_managed_ne_id").trim();
  const toUid = nmsOrUme(args, "to_nms_ne_id", "to_ume_ne_id");
  const toMid = str(args, "to_managed_ne_id").trim();
  if (Boolean(fromUid) === Boolean(fromMid)) {
    return { ok: false, error: "exactly_one_of_from_nms_ne_id_or_from_managed_ne_id_required" };
  }
  if (Boolean(toUid) === Boolean(toMid)) {
    return { ok: false, error: "exactly_one_of_to_nms_ne_id_or_to_managed_ne_id_required" };
  }
  let detail = str(args, "detail", "summary").trim().toLowerCase() || "summary";
  if (detail !== "summary" && detail !== "full")
    detail = "summary";
  const body = {
    max_paths: clampInt(num(args, "max_paths"), 3, 1, 10),
    max_hops: clampInt(num(args, "max_hops"), 6, 1, 12),
    layer: str(args, "layer", "physical").trim() || "physical",
    detail
  };
  if (fromUid)
    body.from_ume_ne_id = fromUid;
  else
    body.from_managed_ne_id = fromMid;
  if (toUid)
    body.to_ume_ne_id = toUid;
  else
    body.to_managed_ne_id = toMid;
  return client.post("/v1/topology/fabric/paths", body, signal, 30000);
}

// src/netx/topology-handlers.ts
function asRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}
function str2(args, key, fallback = "") {
  const v = args[key];
  if (typeof v === "string")
    return v;
  if (typeof v === "number" || typeof v === "boolean")
    return String(v);
  return fallback;
}
function num2(args, key) {
  const v = args[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function bool2(args, key) {
  const v = args[key];
  return typeof v === "boolean" ? v : undefined;
}
function strList2(args, key) {
  const v = args[key];
  if (!Array.isArray(v))
    return [];
  return v.map((x2) => String(x2).trim()).filter((x2) => x2.length > 0);
}
function clampInt2(value, fallback, min, max) {
  const n = value === undefined ? fallback : Math.trunc(value);
  return Math.max(min, Math.min(max, n));
}
function unwrap(out) {
  if (out.ok !== true)
    return out;
  const data = asRecord2(out.data);
  if (Object.keys(data).length === 0)
    return { ok: true, data: out.data };
  return { ok: true, ...data, data };
}
function filterFields(args) {
  const out = {};
  for (const key of ["keyword", "role", "vendor", "link_status"]) {
    const v = str2(args, key).trim();
    if (v)
      out[key] = v;
  }
  return out;
}
function edgeEndpoints(edge) {
  const a = str2(edge, "a_node_id") || str2(edge, "a");
  const b = str2(edge, "b_node_id") || str2(edge, "b");
  return [a.trim(), b.trim()];
}
function collapseEdgesToLinks(edges, includeNames = false) {
  const buckets = new Map;
  for (const raw of edges) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      continue;
    const e = raw;
    const [a, b] = edgeEndpoints(e);
    if (!a || !b || a === b)
      continue;
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    const key = `${lo}\x00${hi}`;
    const row = buckets.get(key) ?? {
      a_node_id: lo,
      b_node_id: hi,
      link_count: 0
    };
    row.link_count = Number(row.link_count || 0) + 1;
    if (includeNames && !row.a_name) {
      if (a === lo) {
        row.a_name = str2(e, "a_name");
        row.b_name = str2(e, "b_name");
      } else {
        row.a_name = str2(e, "b_name");
        row.b_name = str2(e, "a_name");
      }
    }
    buckets.set(key, row);
  }
  return [...buckets.values()];
}
function summarizeViewGraph(graph, sample = 20) {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : Array.isArray(graph.links) ? graph.links : [];
  const sampleNodes = nodes.slice(0, Math.max(0, sample)).map((n) => {
    const row = asRecord2(n);
    return {
      id: str2(row, "id") || str2(row, "fabric_node_id"),
      name: str2(row, "name"),
      x: row.x,
      y: row.y,
      level: row.level,
      role: row.role
    };
  });
  return {
    ok: true,
    view_id: str2(graph, "id") || str2(graph, "view_id"),
    node_count: nodes.length,
    edge_count: edges.length,
    link_count: collapseEdgesToLinks(edges).length,
    links: collapseEdgesToLinks(edges),
    sample_nodes: sampleNodes,
    detail: "summary"
  };
}
function layoutRecipeUnavailable(action) {
  return {
    ok: false,
    error: "layout_recipe_requires_netx_topology_mcp",
    action,
    hint: "Canvas CRUD/query and move_nodes work in dsh-netxops. Dual-unit / orbit / polish recipes still need the netx-topology MCP layout engine (or enable that MCP alongside)."
  };
}
async function getTopologyTree(client, args, signal) {
  const out = unwrap(await client.get("/v1/topology/tree", undefined, signal));
  if (out.ok !== true)
    return out;
  const compact = bool2(args, "compact") !== false;
  const maxDepth = num2(args, "max_depth");
  if (!compact && maxDepth === undefined)
    return out;
  return { ...out, compact, max_depth: maxDepth ?? null };
}
async function getTopologyView(client, args, signal) {
  const viewId = str2(args, "view_id").trim();
  if (!viewId)
    return { ok: false, error: "view_id_required" };
  const out = unwrap(await client.get(`/v1/topology/views/${encodeURIComponent(viewId)}`, undefined, signal, 120000));
  if (out.ok !== true)
    return out;
  const detail = str2(args, "detail", "summary").trim().toLowerCase() || "summary";
  if (detail === "full")
    return { ...out, detail: "full" };
  return summarizeViewGraph(out, clampInt2(num2(args, "sample"), 20, 0, 200));
}
async function createTopologyFolder(client, args, signal) {
  const name = str2(args, "name").trim();
  if (!name)
    return { ok: false, error: "name_required" };
  const body = { name };
  const parentId = str2(args, "parent_id").trim();
  if (parentId)
    body.parent_id = parentId;
  const locale = str2(args, "locale").trim();
  if (locale)
    body.locale = locale;
  if (num2(args, "sort_order") !== undefined)
    body.sort_order = Math.trunc(num2(args, "sort_order"));
  return unwrap(await client.post("/v1/topology/folders", body, signal));
}
async function addTopologyViewNodes(client, args, signal) {
  const viewId = str2(args, "view_id").trim();
  if (!viewId)
    return { ok: false, error: "view_id_required" };
  if (strList2(args, "managed_ne_ids").length || strList2(args, "ume_ne_ids").length) {
    return {
      ok: false,
      error: "fabric_nodes_only",
      detail: "Use keyword/role/vendor/link_status or fabric_node_ids; never managed/UME ids."
    };
  }
  const filters = filterFields(args);
  const fabricIds = strList2(args, "fabric_node_ids");
  if (Object.keys(filters).length === 0 && fabricIds.length === 0) {
    return {
      ok: false,
      error: "filter_or_fabric_node_ids_required",
      detail: "Pass keyword/role/vendor/link_status (preferred) or fabric_node_ids."
    };
  }
  if (num2(args, "max_nodes") !== undefined) {
    const got = unwrap(await client.get(`/v1/topology/views/${encodeURIComponent(viewId)}`, undefined, signal));
    if (got.ok === true) {
      const data = asRecord2(got.data);
      const filt = asRecord2(got.filter ?? data.filter);
      const membership = asRecord2(filt.membership ?? {});
      membership.max_nodes = clampInt2(num2(args, "max_nodes"), 2000, 1, 2000);
      filt.membership = membership;
      await client.patch(`/v1/topology/views/${encodeURIComponent(viewId)}`, { filter: filt }, signal);
    }
  }
  const layout = str2(args, "layout", "grid").trim() || "grid";
  const body = {
    managed_ne_ids: [],
    layout,
    ...filters
  };
  if (fabricIds.length)
    body.fabric_node_ids = fabricIds;
  if (num2(args, "limit") !== undefined)
    body.limit = clampInt2(num2(args, "limit"), 500, 1, 2000);
  if (num2(args, "offset") !== undefined)
    body.offset = clampInt2(num2(args, "offset"), 0, 0, Number.MAX_SAFE_INTEGER);
  return unwrap(await client.post(`/v1/topology/views/${encodeURIComponent(viewId)}/nodes`, body, signal, 180000));
}
async function removeTopologyViewNodes(client, args, signal) {
  const viewId = str2(args, "view_id").trim();
  if (!viewId)
    return { ok: false, error: "view_id_required" };
  const body = { ...filterFields(args) };
  const fabricIds = strList2(args, "fabric_node_ids");
  if (fabricIds.length)
    body.fabric_node_ids = fabricIds;
  return unwrap(await client.post(`/v1/topology/views/${encodeURIComponent(viewId)}/nodes/remove`, body, signal));
}
async function copyTopologyViewNodes(client, args, signal) {
  const sourceId = str2(args, "source_view_id").trim();
  const targetId = str2(args, "target_view_id").trim();
  if (!sourceId || !targetId) {
    return { ok: false, error: "source_view_id_and_target_view_id_required" };
  }
  const source = unwrap(await client.get(`/v1/topology/views/${encodeURIComponent(sourceId)}`, undefined, signal, 120000));
  if (source.ok !== true)
    return source;
  const nodes = Array.isArray(source.nodes) ? source.nodes : [];
  const limit = num2(args, "limit");
  const selected = typeof limit === "number" ? nodes.slice(0, clampInt2(limit, nodes.length, 1, 2000)) : nodes;
  const fabricIds = selected.map((n) => {
    const row = asRecord2(n);
    return str2(row, "id") || str2(row, "fabric_node_id");
  }).filter(Boolean);
  if (bool2(args, "dry_run") === true) {
    return { ok: true, dry_run: true, would_copy: fabricIds.length, source_view_id: sourceId, target_view_id: targetId };
  }
  if (bool2(args, "clear_target") === true) {
    await client.post(`/v1/topology/views/${encodeURIComponent(targetId)}/nodes/remove`, {
      fabric_node_ids: "ALL",
      clear_all: true
    }, signal);
  }
  if (fabricIds.length === 0) {
    return { ok: true, added: 0, source_view_id: sourceId, target_view_id: targetId };
  }
  const add = unwrap(await client.post(`/v1/topology/views/${encodeURIComponent(targetId)}/nodes`, { fabric_node_ids: fabricIds, layout: "keep", managed_ne_ids: [] }, signal, 180000));
  if (add.ok !== true)
    return add;
  if (bool2(args, "copy_positions") !== false) {
    const ox = num2(args, "offset_x") ?? 0;
    const oy = num2(args, "offset_y") ?? 0;
    const positions = selected.map((n) => {
      const row = asRecord2(n);
      const id = str2(row, "id") || str2(row, "fabric_node_id");
      return {
        fabric_node_id: id,
        x: Number(row.x || 0) + ox,
        y: Number(row.y || 0) + oy
      };
    }).filter((p) => p.fabric_node_id);
    if (positions.length) {
      await client.patch(`/v1/topology/views/${encodeURIComponent(targetId)}/positions`, { positions }, signal, 120000);
    }
  }
  return { ok: true, added: fabricIds.length, source_view_id: sourceId, target_view_id: targetId, ...asRecord2(add) };
}
async function updateTopologyViewPositions(client, args, signal) {
  const viewId = str2(args, "view_id").trim();
  if (!viewId)
    return { ok: false, error: "view_id_required" };
  const body = {};
  if (Array.isArray(args.positions))
    body.positions = args.positions;
  const layout = str2(args, "layout").trim();
  if (layout)
    body.layout = layout;
  Object.assign(body, filterFields(args));
  for (const key of ["offset_x", "offset_y", "cols", "gap_x", "gap_y"]) {
    if (num2(args, key) !== undefined)
      body[key] = num2(args, key);
  }
  const fabricIds = strList2(args, "fabric_node_ids");
  if (fabricIds.length)
    body.fabric_node_ids = fabricIds;
  return unwrap(await client.patch(`/v1/topology/views/${encodeURIComponent(viewId)}/positions`, body, signal, 120000));
}
async function projectTopologyNeighbors(client, args, signal) {
  const viewId = str2(args, "view_id").trim();
  if (!viewId)
    return { ok: false, error: "view_id_required" };
  const body = {};
  const seeds = strList2(args, "seed_fabric_node_ids").length ? strList2(args, "seed_fabric_node_ids") : strList2(args, "fabric_node_ids");
  if (seeds.length)
    body.seed_fabric_node_ids = seeds;
  const mids = strList2(args, "managed_ne_ids");
  if (mids.length)
    body.managed_ne_ids = mids;
  const region = str2(args, "region_folder_id").trim();
  if (region)
    body.region_folder_id = region;
  const out = unwrap(await client.post(`/v1/topology/views/${encodeURIComponent(viewId)}/project-neighbors`, body, signal, 180000));
  if (out.ok !== true)
    return out;
  const detail = str2(args, "detail", "summary").trim().toLowerCase() || "summary";
  if (detail === "full" || detail === "raw" || detail === "graph") {
    return { ...out, detail: "full", projected: true };
  }
  return { ...summarizeViewGraph(out, clampInt2(num2(args, "sample"), 20, 0, 100)), projected: true, view_id: viewId };
}
async function queryTopologyFabricNodes(client, args, signal) {
  let mode = str2(args, "mode").trim().toLowerCase();
  const q = str2(args, "q").trim();
  const keyword = str2(args, "keyword").trim();
  if (!mode) {
    if (bool2(args, "summary") === true)
      mode = "summary";
    else if (q)
      mode = "search";
    else
      mode = "list";
  }
  if (mode === "summary" || mode === "stats" || mode === "count") {
    const out2 = unwrap(await client.get("/v1/topology/fabric/summary", undefined, signal));
    return out2.ok === true ? { ...out2, mode: "summary" } : out2;
  }
  if (mode === "search" || mode === "find") {
    const needle = q || keyword;
    if (!needle)
      return { ok: false, error: "q_required", hint: "mode=search needs q (or keyword)." };
    return unwrap(await client.get("/v1/topology/fabric/nodes/search", {
      q: needle,
      page: clampInt2(num2(args, "page"), 1, 1, Number.MAX_SAFE_INTEGER),
      page_size: clampInt2(num2(args, "page_size") ?? num2(args, "limit"), 50, 1, 200)
    }, signal));
  }
  const params = {
    page: clampInt2(num2(args, "page"), 1, 1, Number.MAX_SAFE_INTEGER),
    page_size: clampInt2(num2(args, "page_size") ?? num2(args, "limit"), 50, 1, 500)
  };
  for (const key of ["keyword", "role", "level", "level_major", "region_folder_id", "link_status"]) {
    const v = str2(args, key).trim() || (key === "keyword" ? q : "");
    if (v)
      params[key] = v;
  }
  const out = unwrap(await client.get("/v1/topology/fabric/nodes", params, signal));
  return out.ok === true ? { ...out, mode: "list" } : out;
}
async function classifyTopologyFabricNodes(client, args, signal) {
  const action = str2(args, "action").trim().toLowerCase();
  if (!action)
    return { ok: false, error: "action_required" };
  if (action === "match") {
    const pattern = str2(args, "pattern").trim() || str2(args, "q").trim();
    if (!pattern)
      return { ok: false, error: "pattern_required" };
    return unwrap(await client.post("/v1/topology/fabric/nodes/match", {
      pattern,
      match_field: str2(args, "match_field", "name").trim() || "name",
      sample_limit: clampInt2(num2(args, "sample_limit"), 50, 1, 200)
    }, signal));
  }
  if (action === "tag") {
    const body = {
      fabric_node_ids: strList2(args, "fabric_node_ids"),
      dry_run: bool2(args, "dry_run") === true
    };
    const pattern = str2(args, "pattern").trim() || str2(args, "q").trim();
    if (pattern)
      body.pattern = pattern;
    if (args.level !== undefined)
      body.level = args.level;
    const role = str2(args, "role").trim();
    if (role)
      body.role = role;
    const region = str2(args, "region_folder_id").trim();
    if (region)
      body.region_folder_id = region;
    if (bool2(args, "clear_region") === true)
      body.clear_region = true;
    return unwrap(await client.post("/v1/topology/fabric/nodes/tags/bulk", body, signal));
  }
  if (action === "patch") {
    const nodeId = str2(args, "fabric_node_id").trim() || str2(args, "node_id").trim();
    if (!nodeId)
      return { ok: false, error: "fabric_node_id_required" };
    const body = {};
    if (args.level !== undefined)
      body.level = args.level;
    const role = str2(args, "role").trim();
    if (role)
      body.role = role;
    const region = str2(args, "region_folder_id").trim();
    if (region)
      body.region_folder_id = region;
    if (bool2(args, "clear_region") === true)
      body.clear_region = true;
    return unwrap(await client.patch(`/v1/topology/fabric/nodes/${encodeURIComponent(nodeId)}/tags`, body, signal));
  }
  if (action === "unmatched") {
    return unwrap(await client.get("/v1/topology/classify/unmatched", {
      kind: str2(args, "kind", "any").trim() || "any",
      page: clampInt2(num2(args, "page"), 1, 1, Number.MAX_SAFE_INTEGER),
      page_size: clampInt2(num2(args, "page_size") ?? num2(args, "limit"), 50, 1, 500)
    }, signal));
  }
  if (action === "preview_rules") {
    return unwrap(await client.post("/v1/topology/classify/preview", {}, signal));
  }
  if (action === "apply_rules") {
    const params = {};
    if (bool2(args, "overwrite_manual") === true)
      params.skip_manual = false;
    else if (bool2(args, "skip_manual") !== undefined)
      params.skip_manual = bool2(args, "skip_manual") !== false;
    if (bool2(args, "fill_empty_only") === true)
      params.fill_empty_only = true;
    return unwrap(await client.post("/v1/topology/classify/apply", {}, signal));
  }
  if (action === "list_rules") {
    return unwrap(await client.get("/v1/topology/classify/rules", undefined, signal));
  }
  return { ok: false, error: "unknown_action", action };
}
async function queryTopologyNeighborhood(client, args, signal) {
  const nodeId = str2(args, "node_id").trim();
  if (!nodeId)
    return { ok: false, error: "node_id_required" };
  const out = unwrap(await client.get("/v1/topology/fabric/neighborhood", {
    node_id: nodeId,
    depth: clampInt2(num2(args, "depth"), 1, 1, 3),
    layer: str2(args, "layer", "physical").trim() || "physical"
  }, signal));
  if (out.ok !== true)
    return out;
  const edges = Array.isArray(out.edges) ? out.edges : [];
  return { ...out, links: collapseEdgesToLinks(edges) };
}
async function queryTopologyEdges(client, args, signal) {
  const params = {
    page: clampInt2(num2(args, "page"), 1, 1, Number.MAX_SAFE_INTEGER),
    page_size: clampInt2(num2(args, "page_size"), 100, 1, 500),
    layer: str2(args, "layer", "physical").trim() || "physical"
  };
  for (const key of ["node_id", "keyword", "status", "source"]) {
    const v = str2(args, key).trim();
    if (v)
      params[key] = v;
  }
  const out = unwrap(await client.get("/v1/topology/fabric/edges", params, signal));
  if (out.ok !== true)
    return out;
  const detail = str2(args, "detail", "adjacency").trim().toLowerCase() || "adjacency";
  const items = Array.isArray(out.items) ? out.items : Array.isArray(out.edges) ? out.edges : [];
  if (detail === "ports")
    return { ...out, detail: "ports", items };
  const links = collapseEdgesToLinks(items, true);
  return { ...out, detail: "adjacency", links, items: undefined };
}
async function suggestSinkHubs(client, args, signal) {
  const viewId = str2(args, "source_view_id").trim() || str2(args, "view_id").trim();
  if (!viewId)
    return { ok: false, error: "source_view_id_required" };
  const out = unwrap(await client.get(`/v1/topology/views/${encodeURIComponent(viewId)}`, undefined, signal, 120000));
  if (out.ok !== true)
    return out;
  const nodes = Array.isArray(out.nodes) ? out.nodes : [];
  const edges = Array.isArray(out.edges) ? out.edges : [];
  const degree = new Map;
  for (const raw of edges) {
    const [a, b] = edgeEndpoints(asRecord2(raw));
    if (!a || !b)
      continue;
    degree.set(a, (degree.get(a) || 0) + 1);
    degree.set(b, (degree.get(b) || 0) + 1);
  }
  const exclude = new Set([
    ...strList2(args, "exclude_portal_ids"),
    ...strList2(args, "exclude_fabric_node_ids")
  ]);
  const pick = clampInt2(num2(args, "pick"), 5, 1, 50);
  const hubs = [...degree.entries()].filter(([id]) => !exclude.has(id)).sort((a, b) => b[1] - a[1]).slice(0, pick).map(([fabric_node_id, deg]) => {
    const node = nodes.find((n) => {
      const row2 = asRecord2(n);
      return (str2(row2, "id") || str2(row2, "fabric_node_id")) === fabric_node_id;
    });
    const row = asRecord2(node);
    return {
      fabric_node_id,
      degree: deg,
      name: str2(row, "name"),
      level: row.level,
      role: row.role
    };
  });
  return {
    ok: true,
    source_view_id: viewId,
    hubs,
    hint: "Degree ranking only — full dual_unit-aware suggestSinkHubs lives in netx-topology MCP."
  };
}
async function analyzeTopologyViewLayout(client, args, signal) {
  const viewId = str2(args, "view_id").trim();
  if (!viewId) {
    return {
      ok: false,
      error: "view_id_required",
      hint: "Pass view_id. folder_id sampling without view_id needs netx-topology MCP structure analysis."
    };
  }
  const out = unwrap(await client.get(`/v1/topology/views/${encodeURIComponent(viewId)}`, undefined, signal, 120000));
  if (out.ok !== true)
    return out;
  const nodes = Array.isArray(out.nodes) ? out.nodes : [];
  const edges = Array.isArray(out.edges) ? out.edges : [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let missingxy = 0;
  for (const raw of nodes) {
    const row = asRecord2(raw);
    const x2 = Number(row.x);
    const y = Number(row.y);
    if (!Number.isFinite(x2) || !Number.isFinite(y)) {
      missingxy += 1;
      continue;
    }
    minX = Math.min(minX, x2);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y);
  }
  const degree = new Map;
  for (const raw of edges) {
    const [a, b] = edgeEndpoints(asRecord2(raw));
    if (!a || !b)
      continue;
    degree.set(a, (degree.get(a) || 0) + 1);
    degree.set(b, (degree.get(b) || 0) + 1);
  }
  const hubs = [...degree.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, deg]) => ({ fabric_node_id: id, degree: deg }));
  return {
    ok: true,
    view_id: viewId,
    detail: str2(args, "detail", "summary") || "summary",
    node_count: nodes.length,
    edge_count: edges.length,
    link_count: collapseEdgesToLinks(edges).length,
    missing_xy: missingxy,
    bbox: Number.isFinite(minX) ? { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY } : null,
    hubs,
    hint: "Basic graph stats only. Crossing/dual_unit/score.total analysis needs netx-topology MCP."
  };
}
async function sinkTopologyDualUnits(_client, args) {
  return {
    ok: false,
    error: "sink_dual_units_requires_netx_topology_mcp",
    source_view_id: str2(args, "source_view_id"),
    sink_view_id: str2(args, "sink_view_id"),
    hint: "sinkTopologyDualUnits needs the dual_unit layout engine from netx-topology MCP. Use layoutTopologyView(action=move_nodes, park=true) for HTTP-only parking, or enable the topology MCP."
  };
}
async function layoutTopologyView(client, args, signal) {
  if (bool2(args, "catalog") === true) {
    return {
      ok: true,
      catalog: true,
      actions: [
        "layout",
        "layout_dual_unit",
        "move_nodes",
        "sink_nodes",
        "orbit_sweep",
        "level_bands",
        "polish_crossings",
        "clear_edge_hits",
        "compact_bbox",
        "pull_far_chains",
        "align_reference",
        "fix_overlaps",
        "resolve_overlaps",
        "untangle",
        "straighten_channels",
        "job_status",
        "job_cancel"
      ],
      dsh_supported: ["move_nodes", "sink_nodes", "catalog"],
      recipes: ["rings", "corridor", "compact", "unstick"],
      hint: "Only move_nodes/sink_nodes/catalog run in dsh-netxops; other actions need netx-topology MCP."
    };
  }
  const action = str2(args, "action", "layout").trim().toLowerCase() || "layout";
  if (action === "job_status" || action === "job_cancel") {
    return {
      ok: false,
      error: "layout_jobs_not_in_dsh_host",
      hint: "Background layout jobs are owned by netx-topology MCP."
    };
  }
  if (action === "move_nodes" || action === "sink_nodes") {
    const toId = str2(args, "view_id").trim();
    const fromId = str2(args, "source_view_id").trim();
    const ids = strList2(args, "fabric_node_ids");
    const params = asRecord2(args.params);
    const fabricIds = ids.length ? ids : strList2(params, "fabric_node_ids");
    if (!toId || !fromId) {
      return { ok: false, error: "view_id_and_source_view_id_required" };
    }
    if (fabricIds.length === 0) {
      return { ok: false, error: "fabric_node_ids_required" };
    }
    const copyPositions = bool2(params, "copy_positions") !== false && bool2(args, "copy_positions") !== false;
    const removeFromSource = bool2(params, "remove_from_source") !== false;
    const source = unwrap(await client.get(`/v1/topology/views/${encodeURIComponent(fromId)}`, undefined, signal, 120000));
    if (source.ok !== true)
      return source;
    const nodes = Array.isArray(source.nodes) ? source.nodes : [];
    const wanted = new Set(fabricIds);
    const selected = nodes.filter((n) => {
      const row = asRecord2(n);
      const id = str2(row, "id") || str2(row, "fabric_node_id");
      return wanted.has(id);
    });
    const add = unwrap(await client.post(`/v1/topology/views/${encodeURIComponent(toId)}/nodes`, { fabric_node_ids: fabricIds, layout: copyPositions ? "keep" : "grid", managed_ne_ids: [] }, signal, 180000));
    if (add.ok !== true)
      return add;
    if (copyPositions && selected.length) {
      const ox = Number(params.offset_x || 0);
      const oy = Number(params.offset_y || 0);
      const positions = selected.map((n) => {
        const row = asRecord2(n);
        return {
          fabric_node_id: str2(row, "id") || str2(row, "fabric_node_id"),
          x: Number(row.x || 0) + ox,
          y: Number(row.y || 0) + oy
        };
      }).filter((p) => p.fabric_node_id);
      await client.patch(`/v1/topology/views/${encodeURIComponent(toId)}/positions`, { positions }, signal, 120000);
    }
    if (removeFromSource) {
      await client.post(`/v1/topology/views/${encodeURIComponent(fromId)}/nodes/remove`, { fabric_node_ids: fabricIds }, signal);
    }
    return {
      ok: true,
      action,
      moved: fabricIds.length,
      source_view_id: fromId,
      view_id: toId,
      park: bool2(params, "park") === true || bool2(args, "park") === true
    };
  }
  return layoutRecipeUnavailable(action);
}

// src/netx/tools.ts
var str3 = (description) => ({ type: "string", ...description ? { description } : {} });
var num3 = (description) => ({ type: "number", ...description ? { description } : {} });
var bool3 = (description) => ({ type: "boolean", ...description ? { description } : {} });
var strArr = (description) => ({
  type: "array",
  items: { type: "string" },
  ...description ? { description } : {}
});
var anyObj = (description) => ({
  type: "object",
  additionalProperties: true,
  ...description ? { description } : {}
});
function renderJson(_args, value) {
  return [{ type: "text", text: JSON.stringify(value, null, 0) }];
}
var jsonOut = {
  schema: { type: "json" },
  render: renderJson
};
function tool(name, description, parameters, handler, getClient, timeoutMs) {
  return defineTool({
    name,
    description,
    parameters,
    output: jsonOut,
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const result = await handler(getClient(), args, exec.signal);
      if (result.ok === false) {
        throw new Error(JSON.stringify(result));
      }
      return result;
    }
  });
}
function registerNetxTools(ctx, connection, options) {
  const enabledGroups = options.forceGroups ?? groupsForPlane(connection.groups, options.plane, options.only);
  const allow = toolNamesForGroups(enabledGroups);
  if (allow.size === 0)
    return () => {};
  const client = createNetxClient({
    apiUrl: connection.apiUrl,
    lang: connection.lang,
    timeoutMs: Math.min(connection.toolCallTimeoutMs, 45000),
    getToken: () => getNetxConnection()?.token ?? ""
  });
  const getClient = () => client;
  const t = connection.toolCallTimeoutMs;
  const catalog = [
    tool("netx__queryNmsAlarms", "Query NMS current alarms (each row includes host_name). Supports severity/ne_id/host_name/keyword, last_seen time_from/time_to, pagination. Prefer host_name for display; ne_id is for filters only.", {
      severity: str3(),
      ne_id: str3("Filter only; do not show UUID to users"),
      host_name: str3("Filter by NE host_name"),
      ne_name: str3("Legacy alias mapped to keyword"),
      keyword: str3("Substring on cause/object/event. Examples: LOS, Fiber Break, bandwidth, CRC."),
      time_from: str3("ISO time; filters last_seen_at >="),
      time_to: str3("ISO time; filters last_seen_at <="),
      page: num3(),
      page_size: num3()
    }, queryUmeAlarms, getClient, t),
    tool("netx__aggregateNmsAlarms", "Aggregate NMS current alarms (by_severity + top by_ne). If group_by is set, routes to aggregateUmeAlarmsRaw. Always filter severity/keyword/time before paging.", {
      severity: str3("Optional perceived_severity filter (critical/major/minor/warning)."),
      top_ne: num3("Max NE buckets (default 50). Ignored when group_by is set."),
      exclude_missing_host: bool3("Omit missing host_name from by_ne."),
      time_from: str3(),
      time_to: str3(),
      group_by: str3("When set, routes to raw aggregation. Prefer alarm_host_name."),
      group_by2: str3(),
      is_cleared: str3(),
      ne_id: str3(),
      event_type: str3(),
      keyword: str3(),
      limit: num3()
    }, aggregateUmeAlarms, getClient, t),
    tool("netx__runNmsDiagnostics", "NMS alarm diagnostics: severity, top_event_types, top_alarm_codes, top_ne, protocol buckets, freshness meta.", {}, runUmeDiagnostics, getClient, t),
    tool("netx__queryNmsNeInventory", "Paged NMS NE inventory synced in netx (keyword matches ne_id/ne_name/user_label/ip/host_name).", {
      keyword: str3(),
      page: num3(),
      page_size: num3()
    }, queryUmeNeInventory, getClient, t),
    tool("netx__getNmsNe", "Get single NMS NE detail by ne_id (UUID).", {
      ne_id: { type: "string", required: true, description: "NMS inventory ne_id (UUID)." }
    }, getUmeNe, getClient, t),
    tool("netx__queryNmsAlarmsRaw", "Power query NMS current alarms with full alarm_* + ne_* fields; optional field_preset or select_fields. Use field_preset=evidence for citations.", {
      severity: str3(),
      is_cleared: str3(),
      ne_id: str3(),
      event_type: str3(),
      keyword: str3(),
      time_from: str3(),
      time_to: str3(),
      order_by: str3("last_seen_at | time_created | perceived_severity | event_type | ne_id"),
      order: str3("asc | desc"),
      select_fields: strArr(),
      field_preset: str3("brief | evidence | ne_debug"),
      page: num3(),
      page_size: num3()
    }, queryUmeAlarmsRaw, getClient, t),
    tool("netx__aggregateNmsAlarmsRaw", "Dynamic aggregation on NMS raw fields (group_by/group_by2); prefer alarm_host_name.", {
      group_by: { type: "string", required: true },
      group_by2: str3(),
      severity: str3(),
      is_cleared: str3(),
      ne_id: str3(),
      event_type: str3(),
      keyword: str3(),
      time_from: str3(),
      time_to: str3(),
      exclude_missing_host: bool3(),
      limit: num3()
    }, aggregateUmeAlarmsRaw, getClient, t),
    tool("netx__listNmsAlarmFields", "List available fields for NMS raw alarm queries.", {}, listUmeAlarmFields, getClient, t),
    tool("netx__sqlQueryNms", "Read-only SELECT on NMS tables (ume_alarms_current/ume_inventory_ne); server enforces limits. Requires sql:query scope.", {
      sql: { type: "string", required: true },
      limit: num3(),
      statement_timeout_ms: num3()
    }, sqlQueryUme, getClient, t),
    tool("netx__listManagedNe", "List filtered netx managed NEs (keyword/vendor/connect_status required); use before execManagedNe.", {
      keyword: str3(),
      vendor: str3(),
      connect_status: str3("unknown | testing | pass | fail"),
      page: num3(),
      page_size: num3()
    }, listManagedNe, getClient, t),
    tool("netx__getManagedNe", "Get one managed NE by managed ne_id (from listManagedNe / listCliTargets source=managed). Do NOT pass NMS inventory UUID here.", {
      ne_id: str3("Managed NE id"),
      managed_ne_id: str3("Alias for ne_id"),
      id: str3("Alias for ne_id")
    }, getManagedNe, getClient, t),
    tool("netx__execManagedNe", "Run read-only CLI via netx (show/display/ping/traceroute). Single NE: ne_id OR ume_ne_id + commands. Many NEs: ne_ids[]/ume_ne_ids[] + shared commands, or targets[{ume_ne_id|ne_id, commands}]. Do NOT loop one-NE calls for multi-NE work.", {
      ne_id: str3(),
      nms_ne_id: str3("NMS inventory id; alias ume_ne_id"),
      ume_ne_id: str3("Legacy alias of nms_ne_id"),
      ne_ids: strArr("Managed NE ids for concurrent batch (shared commands)."),
      nms_ne_ids: strArr("NMS inventory ids; alias ume_ne_ids"),
      ume_ne_ids: strArr("Legacy alias of nms_ne_ids"),
      targets: {
        type: "array",
        description: "Per-NE command sets: each item is one NE (ne_id OR ume_ne_id) with commands[].",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            ne_id: str3(),
            nms_ne_id: str3(),
            ume_ne_id: str3(),
            commands: strArr()
          }
        }
      },
      commands: strArr("Commands for single NE, or shared commands for batch."),
      read_timeout_sec: num3("Per-command read timeout (default 60; use 90–120 for slow show)."),
      concurrency: num3("Parallel NEs for batch mode (1–8, default 4)."),
      async: bool3("oclaw-only async hint; ignored by native REST client.")
    }, execManagedNe, getClient, Math.max(t, 300000)),
    tool("netx__listCliTargets", "List CLI-capable targets (managed NE and/or NMS inventory). Call once per session with keyword/source, cache ids, then execManagedNe.", {
      source: str3("managed | nms | ume | all"),
      keyword: str3(),
      page: num3(),
      page_size: num3()
    }, listCliTargets, getClient, t),
    tool("netx__findTopologyPaths", "Find up to max_paths simple paths between two fabric nodes (common group — native netx, not NMS-bound). For each endpoint provide exactly one of ume_ne_id or managed_ne_id.", {
      from_nms_ne_id: str3("NMS inventory id"),
      from_ume_ne_id: str3("Legacy alias of from_nms_ne_id"),
      from_managed_ne_id: str3(),
      to_nms_ne_id: str3("NMS inventory id"),
      to_ume_ne_id: str3("Legacy alias of to_nms_ne_id"),
      to_managed_ne_id: str3(),
      max_paths: num3(),
      max_hops: num3(),
      layer: str3(),
      detail: str3("summary | full")
    }, findTopologyPaths, getClient, t),
    tool("netx__getTopologyTree", "Get topology folder tree (nav roots + Root map canvases). Start here before createTopologyFolder.", { compact: bool3(), max_depth: num3() }, getTopologyTree, getClient, t),
    tool("netx__getTopologyView", "Get a topology view by view_id. Default detail=summary with sample_nodes + links[].", {
      view_id: { type: "string", required: true },
      detail: str3("summary | full"),
      sample: num3()
    }, getTopologyView, getClient, t),
    tool("netx__createTopologyFolder", "Create topology folders / region canvases. Only way to create canvases (ne:write).", {
      name: { type: "string", required: true },
      parent_id: str3(),
      locale: str3("zh | en"),
      sort_order: num3()
    }, createTopologyFolder, getClient, t),
    tool("netx__addTopologyViewNodes", "Bulk-place fabric nodes on a view via filters or fabric_node_ids (never managed/UME ids).", {
      view_id: { type: "string", required: true },
      max_nodes: num3(),
      keyword: str3(),
      role: str3(),
      vendor: str3(),
      link_status: str3(),
      limit: num3(),
      offset: num3(),
      fabric_node_ids: strArr(),
      layout: str3("grid | keep")
    }, addTopologyViewNodes, getClient, t),
    tool("netx__removeTopologyViewNodes", "Remove placements from a view (not fabric) by filters or fabric_node_ids.", {
      view_id: { type: "string", required: true },
      keyword: str3(),
      role: str3(),
      vendor: str3(),
      link_status: str3(),
      fabric_node_ids: strArr()
    }, removeTopologyViewNodes, getClient, t),
    tool("netx__copyTopologyViewNodes", "Clone fabric placements from source_view_id onto target_view_id (optional clear_target / copy_positions).", {
      source_view_id: { type: "string", required: true },
      target_view_id: { type: "string", required: true },
      copy_positions: bool3(),
      clear_target: bool3(),
      offset_x: num3(),
      offset_y: num3(),
      limit: num3(),
      dry_run: bool3()
    }, copyTopologyViewNodes, getClient, t),
    tool("netx__updateTopologyViewPositions", "Move nodes on a view via positions[] or layout=grid|offset|stack + filters.", {
      view_id: { type: "string", required: true },
      positions: {
        type: "array",
        description: "Manual placements: [{ fabric_node_id, x, y }, …]",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            fabric_node_id: str3(),
            x: num3(),
            y: num3()
          }
        }
      },
      layout: str3("grid | offset | stack"),
      keyword: str3(),
      role: str3(),
      vendor: str3(),
      link_status: str3(),
      fabric_node_ids: strArr(),
      offset_x: num3(),
      offset_y: num3()
    }, updateTopologyViewPositions, getClient, t),
    tool("netx__projectTopologyNeighbors", "Project existing fabric neighbors of on-view nodes onto the canvas.", {
      view_id: { type: "string", required: true },
      seed_fabric_node_ids: strArr(),
      managed_ne_ids: strArr(),
      region_folder_id: str3(),
      detail: str3("summary | full"),
      sample: num3()
    }, projectTopologyNeighbors, getClient, t),
    tool("netx__queryTopologyFabricNodes", "Fabric inventory: mode=summary|list|search (keyword/role/level/region/link_status).", {
      mode: str3("summary | list | search"),
      q: str3(),
      keyword: str3(),
      role: str3(),
      level: str3(),
      level_major: str3(),
      region_folder_id: str3(),
      link_status: str3(),
      page: num3(),
      page_size: num3(),
      limit: num3(),
      summary: bool3()
    }, queryTopologyFabricNodes, getClient, t),
    tool("netx__classifyTopologyFabricNodes", "Classify fabric nodes: action=match|tag|patch|unmatched|preview_rules|apply_rules|list_rules.", {
      action: { type: "string", required: true },
      pattern: str3(),
      q: str3(),
      match_field: str3(),
      sample_limit: num3(),
      fabric_node_ids: strArr(),
      fabric_node_id: str3(),
      node_id: str3(),
      level: str3(),
      role: str3(),
      region_folder_id: str3(),
      clear_region: bool3(),
      dry_run: bool3(),
      kind: str3(),
      page: num3(),
      page_size: num3(),
      skip_manual: bool3(),
      overwrite_manual: bool3(),
      fill_empty_only: bool3()
    }, classifyTopologyFabricNodes, getClient, t),
    tool("netx__queryTopologyNeighborhood", "Neighborhood around a fabric node (depth 1–3) with compact links[].", {
      node_id: { type: "string", required: true },
      depth: num3(),
      layer: str3()
    }, queryTopologyNeighborhood, getClient, t),
    tool("netx__queryTopologyEdges", "Fabric adjacency links[] (detail=adjacency) or port rows (detail=ports).", {
      node_id: str3(),
      keyword: str3(),
      layer: str3(),
      status: str3(),
      source: str3("lldp | ume | manual"),
      detail: str3("adjacency | ports"),
      page: num3(),
      page_size: num3()
    }, queryTopologyEdges, getClient, t),
    tool("netx__suggestSinkHubs", "Rank hub territories on a source view for non-dual move_nodes(park) batches (degree stand-in in DSH).", {
      source_view_id: str3(),
      view_id: str3(),
      pick: num3(),
      exclude_portal_ids: strArr(),
      exclude_fabric_node_ids: strArr()
    }, suggestSinkHubs, getClient, t),
    tool("netx__analyzeTopologyViewLayout", "Basic layout QA for a view (bbox/hubs). Full dual_unit/crossing scores need netx-topology MCP.", {
      view_id: str3(),
      folder_id: str3(),
      detail: str3("summary | structure | hotspots | blocks | both"),
      score_profile: str3(),
      sight_limit: num3(),
      max_views: num3(),
      min_nodes: num3(),
      max_nodes: num3(),
      with_meta: bool3()
    }, analyzeTopologyViewLayout, getClient, t),
    tool("netx__sinkTopologyDualUnits", "Drain dual_unit eyes from source to sink (requires netx-topology MCP layout engine in DSH).", {
      source_view_id: str3(),
      sink_view_id: str3(),
      max_units: num3(),
      min_nodes: num3(),
      max_nodes: num3(),
      max_batch_nodes: num3(),
      layout_batch: bool3(),
      until_empty: bool3(),
      dry_run: bool3()
    }, sinkTopologyDualUnits, getClient, t),
    tool("netx__layoutTopologyView", "Layout / polish a canvas. DSH supports catalog + move_nodes|sink_nodes over HTTP; dual_unit/orbit/polish recipes need netx-topology MCP.", {
      view_id: str3(),
      action: str3(),
      source_view_id: str3(),
      recipe: str3(),
      preset: str3(),
      mode: str3("preview | apply"),
      tune: bool3(),
      params: anyObj("Action-specific options (move_nodes / recipes / polish)."),
      catalog: bool3(),
      fabric_node_ids: strArr(),
      park: bool3(),
      copy_positions: bool3()
    }, layoutTopologyView, getClient, Math.max(t, 180000))
  ];
  const disposers = catalog.filter((entry) => allow.has(entry.name)).map((entry) => ctx.tools.register(entry));
  return () => {
    for (const dispose of disposers)
      dispose();
  };
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
  alarmPushEnabled: z.boolean().default(false),
  alarmDeliverDsh: z.boolean().default(true),
  alarmDeliverIm: z.boolean().default(false),
  imTargets: z.string().default(""),
  imBotId: z.string().default(""),
  imTargetId: z.string().default(""),
  nmsProvider: z.string().default("zte-ume"),
  groupOpsInPreset: z.boolean().default(true),
  groupOpsPublic: z.boolean().default(false),
  groupTopologyInPreset: z.boolean().default(false),
  groupTopologyPublic: z.boolean().default(false)
});
function packageRoot() {
  return join3(dirname2(fileURLToPath2(import.meta.url)), "..");
}
function resolveDshHome() {
  const fromEnv = process.env.DSH_HOME?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0)
    return fromEnv;
  return join3(homedir3(), ".dsh");
}
function ensureAgentPresetInstalled(logger) {
  const src = join3(packageRoot(), "presets", NETXOPS_PRESET_ID);
  const composition = join3(src, "agent.cordis.yml");
  if (!existsSync2(composition)) {
    logger.warn("netxops: bundled preset missing at %s — skip user-preset install", src);
    return;
  }
  const destParent = join3(resolveDshHome(), ".agent-presets");
  const dest = join3(destParent, NETXOPS_PRESET_ID);
  try {
    mkdirSync(destParent, { recursive: true });
    if (existsSync2(dest)) {
      rmSync(dest, { recursive: true, force: true });
    }
    cpSync(src, dest, { recursive: true });
    writeFileSync(join3(dest, ".dsh-netxops-managed"), `${new Date().toISOString()}
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
  const restartAlarmPush = (current, apiUrl, token) => {
    stopAlarmPush?.();
    stopAlarmPush = undefined;
    resetAlarmSession();
    if (!current.alarmPushEnabled) {
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
    const lang = current.lang;
    const deliverDsh = current.alarmDeliverDsh !== false;
    const imTargets = resolveImTargets({
      imTargets: current.imTargets ?? "",
      imBotId: current.imBotId ?? "",
      imTargetId: current.imTargetId ?? ""
    });
    const deliverIm = imTargets.length > 0;
    stopAlarmPush = startAlarmPushClient({
      apiUrl,
      token,
      logger: ctx.logger,
      onAlarm: async (payload) => {
        if (deliverDsh) {
          await deliverAlarmToSession(ctx, payload, lang);
        }
        await deliverAlarmToIm(ctx, payload, {
          enabled: deliverIm,
          targets: imTargets,
          lang
        });
      }
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
      const groups = capabilityGroupsFromSettings(current);
      if (current.nmsProvider && current.nmsProvider !== "zte-ume") {
        ctx.logger.warn("netxops: nmsProvider=%s is not implemented yet; using zte-ume REST adapter", current.nmsProvider);
      }
      publishNetxConnection({
        apiUrl,
        token,
        lang: current.lang,
        toolCallTimeoutMs: current.toolCallTimeoutMs,
        groups
      });
      restartAlarmPush(current, apiUrl, token);
      if (!tokenConfigured) {
        ctx.logger.warn("netxops: published connection → %s tokenConfigured=false (set credential %s)", apiUrl, current.tokenCredentialRef);
      } else {
        const imSinkCount = resolveImTargets({
          imTargets: current.imTargets ?? "",
          imBotId: current.imBotId ?? "",
          imTargetId: current.imTargetId ?? ""
        }).length;
        ctx.logger.info("netxops: published connection → %s tokenConfigured=true alarmPush=%s dsh=%s im=%s public=[%s]", apiUrl, current.alarmPushEnabled === true, current.alarmDeliverDsh !== false, imSinkCount, groupsForPlane(groups, "public").join(",") || "(none)");
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
  ctx.inject(["tools"], (toolsCtx) => {
    let unregisterTools;
    const remountPublicTools = () => {
      unregisterTools?.();
      unregisterTools = undefined;
      const connection = getNetxConnection();
      if (!connection)
        return;
      const enabled = groupsForPlane(connection.groups, "public");
      unregisterTools = registerNetxTools(toolsCtx, connection, { plane: "public" });
      toolsCtx.logger.info("netxops: host public tools groups=[%s]", enabled.join(",") || "(none)");
    };
    remountPublicTools();
    const stopWatch = watchNetxConnection(() => {
      remountPublicTools();
    });
    toolsCtx.effect(() => () => {
      stopWatch();
      unregisterTools?.();
    }, "netxops: dispose public tools");
  });
  ctx.inject(["skills"], (skillsCtx) => {
    let unregisterSkills;
    let generation2 = 0;
    const remountPublicSkills = () => {
      const gen = ++generation2;
      unregisterSkills?.();
      unregisterSkills = undefined;
      const connection = getNetxConnection();
      if (!connection)
        return;
      const enabled = groupsForPlane(connection.groups, "public");
      registerGroupSkills(skillsCtx, enabled, "netxops-public").then((dispose) => {
        if (gen !== generation2) {
          dispose();
          return;
        }
        unregisterSkills = dispose;
        skillsCtx.logger.info("netxops: host public skills groups=[%s]", enabled.join(",") || "(none)");
      }).catch((error) => {
        skillsCtx.logger.warn("netxops: public skill register failed: %s", error);
      });
    };
    remountPublicSkills();
    const stopWatch = watchNetxConnection(() => {
      remountPublicSkills();
    });
    skillsCtx.effect(() => () => {
      generation2 += 1;
      stopWatch();
      unregisterSkills?.();
    }, "netxops: dispose public skills");
  });
  ctx.inject(["connection"], (connCtx) => {
    const connection = connCtx.connection;
    const rpc = connection?.rpc;
    if (!rpc || typeof rpc.handle !== "function") {
      connCtx.logger.warn("netxops: connection.rpc.handle unavailable — alarm status UI disabled");
    } else {
      connCtx.effect(() => {
        const dispose = rpc.handle(NETXOPS_RPC_CHANNEL, async (endpoint) => {
          if (endpoint === "alarm-push.status") {
            return { ok: true, value: getAlarmPushStatus() };
          }
          if (endpoint === "sessions.export.status") {
            const value = await getSessionsExportStatus(ctx);
            return { ok: true, value };
          }
          if (endpoint === "im-delivery.catalog") {
            const fromGet = typeof ctx.get === "function" ? ctx.get("dshIm") : undefined;
            const im = fromGet ?? ctx.dshIm;
            if (!im || typeof im.listDeliveryCatalog !== "function") {
              return {
                ok: true,
                value: {
                  available: false,
                  options: [],
                  hint: "dsh-im-ops missing or outdated — install ≥ops.24 for delivery picker"
                }
              };
            }
            try {
              const options = await im.listDeliveryCatalog();
              return {
                ok: true,
                value: {
                  available: true,
                  options: Array.isArray(options) ? options : []
                }
              };
            } catch (error) {
              return {
                ok: true,
                value: {
                  available: false,
                  options: [],
                  hint: error instanceof Error ? error.message : String(error)
                }
              };
            }
          }
          return { ok: false, error: { code: "bad-request", message: "Unknown endpoint." } };
        });
        return () => {
          dispose();
        };
      }, "netxops: alarm-push status rpc");
    }
    const fetchApi = connection?.fetch;
    if (!fetchApi || typeof fetchApi.register !== "function") {
      connCtx.logger.warn("netxops: connection.fetch.register unavailable — sessions export download disabled");
    } else {
      connCtx.effect(() => {
        const dispose = fetchApi.register({
          path: NETXOPS_SESSIONS_EXPORT_PATH,
          methods: ["GET", "HEAD"],
          fetch: async (request) => {
            if (request.method === "HEAD") {
              return sessionsExportHeadResponse(ctx, request);
            }
            return sessionsExportResponse(ctx, request);
          }
        });
        return () => {
          dispose();
        };
      }, "netxops: sessions export fetch");
    }
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
