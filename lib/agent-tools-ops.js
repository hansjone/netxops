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
function groupsForPlane(groups, plane, only) {
  const policy = groups ?? DEFAULT_CAPABILITY_GROUPS;
  const enabled = CAPABILITY_GROUP_IDS.filter((id) => plane === "preset" ? policy[id].inPreset : policy[id].public);
  if (!only || only.length === 0)
    return enabled;
  const allow = new Set(only);
  return enabled.filter((id) => allow.has(id));
}
function groupsForced(only) {
  const normalized = only.map((id) => id === "nms" || id === "common" ? "ops" : id);
  return CAPABILITY_GROUP_IDS.filter((id) => normalized.includes(id));
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
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
function opsSkillsRoot() {
  const envRoot = process.env.NETX_SKILLS_ROOT?.trim();
  if (envRoot && existsSync(envRoot))
    return envRoot;
  const here = dirname(fileURLToPath(import.meta.url));
  const siblingCandidates = [
    join(here, "..", "..", "..", "netx", "skills"),
    join(here, "..", "..", "netx", "skills")
  ];
  for (const candidate of siblingCandidates) {
    if (existsSync(candidate))
      return candidate;
  }
  const packaged = [
    join(here, "..", "presets", "netxops", "skills"),
    join(here, "..", "..", "presets", "netxops", "skills")
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
  const skillPath = join(dir, "SKILL.md");
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
  const groupDir = join(skillsRoot, SKILL_DIR_BY_GROUP[groupId]);
  let entries;
  try {
    entries = await readdir(groupDir);
  } catch {
    return [];
  }
  const skills = [];
  for (const entry of entries) {
    const full = join(groupDir, entry);
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
var STORE_KEY = Symbol.for("dsh-netxops.connection-store");
function store() {
  const root = globalThis;
  let current = root[STORE_KEY];
  if (current === undefined) {
    current = { connection: undefined, listeners: new Set };
    root[STORE_KEY] = current;
  }
  return current;
}
function getNetxConnection() {
  return store().connection;
}
function watchNetxConnection(listener) {
  const state = store();
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
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
  return v.map((x) => String(x).trim()).filter((x) => x.length > 0);
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
  return v.map((x) => String(x).trim()).filter((x) => x.length > 0);
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
    const x = Number(row.x);
    const y = Number(row.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      missingxy += 1;
      continue;
    }
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
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

// src/netx/group-tools-plugin.ts
function applyGroupToolsPlugin(ctx, options) {
  let unregisterTools;
  let unregisterSkills;
  let skillGeneration = 0;
  const resolveGroups = () => {
    const connection = getNetxConnection();
    if (options.mode === "forced") {
      return groupsForced(options.only ?? []);
    }
    return groupsForPlane(connection?.groups, "preset", options.only);
  };
  const remountTools = () => {
    unregisterTools?.();
    unregisterTools = undefined;
    const connection = getNetxConnection();
    if (connection === undefined) {
      ctx.logger.warn("%s: no connection yet — waiting for host settings bridge", options.name);
      return;
    }
    const enabled = resolveGroups();
    if (enabled.length === 0) {
      ctx.logger.info("%s: no groups enabled", options.name);
      return;
    }
    unregisterTools = registerNetxTools(ctx, connection, {
      plane: "preset",
      only: options.mode === "forced" ? enabled : options.only,
      forceGroups: options.mode === "forced" ? enabled : undefined
    });
    ctx.logger.info("%s: groups=[%s] → %s tokenConfigured=%s", options.name, enabled.join(",") || "(none)", connection.apiUrl, connection.token.trim().length > 0);
  };
  remountTools();
  const stopToolWatch = watchNetxConnection(() => {
    remountTools();
  });
  ctx.inject(["skills"], (skillsCtx) => {
    const remountSkills = () => {
      const gen = ++skillGeneration;
      unregisterSkills?.();
      unregisterSkills = undefined;
      if (getNetxConnection() === undefined)
        return;
      const enabled = resolveGroups();
      registerGroupSkills(skillsCtx, enabled, options.name).then((dispose) => {
        if (gen !== skillGeneration) {
          dispose();
          return;
        }
        unregisterSkills = dispose;
      }).catch((error) => {
        skillsCtx.logger.warn("%s: skill register failed: %s", options.name, error);
      });
    };
    remountSkills();
    const stopSkillWatch = watchNetxConnection(() => {
      remountSkills();
    });
    skillsCtx.effect(() => () => {
      skillGeneration += 1;
      stopSkillWatch();
      unregisterSkills?.();
      unregisterSkills = undefined;
    }, `${options.name}: dispose skills`);
  });
  ctx.effect(() => () => {
    stopToolWatch();
    unregisterTools?.();
    unregisterTools = undefined;
  }, `${options.name}: dispose tools`);
}

// src/agent-tools-ops.ts
var name = "netxops-tools-ops";
var inject = ["tools"];
function apply(ctx) {
  applyGroupToolsPlugin(ctx, { name, mode: "forced", only: ["ops"] });
}
export {
  name,
  inject,
  apply
};
