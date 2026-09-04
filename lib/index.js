// src/index.ts
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import z from "@deepseek-ai/schemastery";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import * as DshSettings from "@deepseek-ai/dsh-settings";

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
  const headers = {
    accept: "application/json"
  };
  if (connection.token.trim().length > 0) {
    headers.authorization = `Bearer ${connection.token.trim()}`;
  }
  const langParams = () => {
    const lang = connection.lang.trim().toLowerCase();
    if (lang.startsWith("en"))
      return { lang: "en" };
    return {};
  };
  async function request(method, path, options = {}) {
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
      const init = {
        method,
        headers: options.body === undefined ? headers : { ...headers, "content-type": "application/json" },
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
      hint: "Pass managed NE id from listManagedNe/listCliTargets (source=managed). For UME inventory UUIDs use execManagedNe(ume_ne_id=...) or getUmeNe, not getManagedNe.",
      example: { ne_id: "<managed-ne-uuid-from-listManagedNe>" }
    };
  }
  const out = await client.get(`/v1/managed-ne/${quoteNeId(neId)}`, undefined, signal);
  if (out.ok === false) {
    const detail = `${str(out, "detail")}${str(out, "error")}`.toLowerCase();
    if (detail.includes("404") || detail.includes("not_found") || detail.includes("not found") || out.error === "netx_http_404") {
      return {
        ...out,
        hint: "Managed NE not found for this ne_id. Call listManagedNe(keyword=...) or listCliTargets(source=managed) first. If this is a UME ne_id, use execManagedNe(ume_ne_id=...) / getUmeNe instead of getManagedNe."
      };
    }
  }
  return out;
}
async function execManagedNe(client, args, signal) {
  const targetsRaw = args.targets;
  const neIds = strList(args, "ne_ids");
  const umeNeIds = strList(args, "ume_ne_ids");
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
        const umeNeId2 = str(row, "ume_ne_id").trim();
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
  const umeNeId = str(args, "ume_ne_id").trim();
  if (Boolean(neId) === Boolean(umeNeId)) {
    return {
      ok: false,
      error: "exactly_one_of_ne_id_or_ume_ne_id_required",
      error_code: "exactly_one_of_ne_id_or_ume_ne_id_required",
      hint: "For one NE pass ne_id OR ume_ne_id. For many NEs pass ne_ids / ume_ne_ids with shared commands, or targets[] with per-NE commands — one call, concurrent on server."
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
  const fromUid = str(args, "from_ume_ne_id").trim();
  const fromMid = str(args, "from_managed_ne_id").trim();
  const toUid = str(args, "to_ume_ne_id").trim();
  const toMid = str(args, "to_managed_ne_id").trim();
  if (Boolean(fromUid) === Boolean(fromMid)) {
    return { ok: false, error: "exactly_one_of_from_ume_ne_id_or_from_managed_ne_id_required" };
  }
  if (Boolean(toUid) === Boolean(toMid)) {
    return { ok: false, error: "exactly_one_of_to_ume_ne_id_or_to_managed_ne_id_required" };
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

// src/netx/tools.ts
var str2 = (description) => ({ type: "string", ...description ? { description } : {} });
var num2 = (description) => ({ type: "number", ...description ? { description } : {} });
var bool2 = (description) => ({ type: "boolean", ...description ? { description } : {} });
var strArr = (description) => ({
  type: "array",
  items: { type: "string" },
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
function registerNetxTools(ctx, connection) {
  const client = createNetxClient({
    apiUrl: connection.apiUrl,
    token: connection.token,
    lang: connection.lang,
    timeoutMs: Math.min(connection.toolCallTimeoutMs, 45000)
  });
  const getClient = () => client;
  const t = connection.toolCallTimeoutMs;
  const disposers = [
    ctx.tools.register(tool("netx__queryUmeAlarms", "Query UME current alarms (each row includes host_name). Supports severity/ne_id/host_name/keyword, last_seen time_from/time_to, pagination. Prefer host_name for display; ne_id is for filters only.", {
      severity: str2(),
      ne_id: str2("Filter only; do not show UUID to users"),
      host_name: str2("Filter by NE host_name"),
      ne_name: str2("Legacy alias mapped to keyword"),
      keyword: str2("Substring on cause/object/event. Examples: LOS, Fiber Break, bandwidth, CRC."),
      time_from: str2("ISO time; filters last_seen_at >="),
      time_to: str2("ISO time; filters last_seen_at <="),
      page: num2(),
      page_size: num2()
    }, queryUmeAlarms, getClient, t)),
    ctx.tools.register(tool("netx__aggregateUmeAlarms", "Aggregate UME current alarms (by_severity + top by_ne). If group_by is set, routes to aggregateUmeAlarmsRaw. Always filter severity/keyword/time before paging.", {
      severity: str2("Optional perceived_severity filter (critical/major/minor/warning)."),
      top_ne: num2("Max NE buckets (default 50). Ignored when group_by is set."),
      exclude_missing_host: bool2("Omit missing host_name from by_ne."),
      time_from: str2(),
      time_to: str2(),
      group_by: str2("When set, routes to raw aggregation. Prefer alarm_host_name."),
      group_by2: str2(),
      is_cleared: str2(),
      ne_id: str2(),
      event_type: str2(),
      keyword: str2(),
      limit: num2()
    }, aggregateUmeAlarms, getClient, t)),
    ctx.tools.register(tool("netx__runUmeDiagnostics", "UME alarm diagnostics: severity, top_event_types, top_alarm_codes, top_ne, protocol buckets, freshness meta.", {}, runUmeDiagnostics, getClient, t)),
    ctx.tools.register(tool("netx__queryUmeNeInventory", "Paged UME NE inventory synced in netx (keyword matches ne_id/ne_name/user_label/ip/host_name).", {
      keyword: str2(),
      page: num2(),
      page_size: num2()
    }, queryUmeNeInventory, getClient, t)),
    ctx.tools.register(tool("netx__getUmeNe", "Get single UME NE detail by ne_id (UUID).", {
      ne_id: { type: "string", required: true, description: "UME inventory ne_id (UUID)." }
    }, getUmeNe, getClient, t)),
    ctx.tools.register(tool("netx__queryUmeAlarmsRaw", "Power query UME current alarms with full alarm_* + ne_* fields; optional field_preset or select_fields. Use field_preset=evidence for citations.", {
      severity: str2(),
      is_cleared: str2(),
      ne_id: str2(),
      event_type: str2(),
      keyword: str2(),
      time_from: str2(),
      time_to: str2(),
      order_by: str2("last_seen_at | time_created | perceived_severity | event_type | ne_id"),
      order: str2("asc | desc"),
      select_fields: strArr(),
      field_preset: str2("brief | evidence | ne_debug"),
      page: num2(),
      page_size: num2()
    }, queryUmeAlarmsRaw, getClient, t)),
    ctx.tools.register(tool("netx__aggregateUmeAlarmsRaw", "Dynamic aggregation on UME raw fields (group_by/group_by2); prefer alarm_host_name.", {
      group_by: { type: "string", required: true },
      group_by2: str2(),
      severity: str2(),
      is_cleared: str2(),
      ne_id: str2(),
      event_type: str2(),
      keyword: str2(),
      time_from: str2(),
      time_to: str2(),
      exclude_missing_host: bool2(),
      limit: num2()
    }, aggregateUmeAlarmsRaw, getClient, t)),
    ctx.tools.register(tool("netx__listUmeAlarmFields", "List available fields for UME raw alarm queries.", {}, listUmeAlarmFields, getClient, t)),
    ctx.tools.register(tool("netx__sqlQueryUme", "Read-only SELECT on UME tables (ume_alarms_current/ume_inventory_ne); server enforces limits. Requires sql:query scope.", {
      sql: { type: "string", required: true },
      limit: num2(),
      statement_timeout_ms: num2()
    }, sqlQueryUme, getClient, t)),
    ctx.tools.register(tool("netx__listManagedNe", "List filtered netx managed NEs (keyword/vendor/connect_status required); use before execManagedNe.", {
      keyword: str2(),
      vendor: str2(),
      connect_status: str2("unknown | testing | pass | fail"),
      page: num2(),
      page_size: num2()
    }, listManagedNe, getClient, t)),
    ctx.tools.register(tool("netx__getManagedNe", "Get one managed NE by managed ne_id (from listManagedNe / listCliTargets source=managed). Do NOT pass UME inventory UUID here.", {
      ne_id: str2("Managed NE id"),
      managed_ne_id: str2("Alias for ne_id"),
      id: str2("Alias for ne_id")
    }, getManagedNe, getClient, t)),
    ctx.tools.register(tool("netx__execManagedNe", "Run read-only CLI via netx (show/display/ping/traceroute). Single NE: ne_id OR ume_ne_id + commands. Many NEs: ne_ids[]/ume_ne_ids[] + shared commands, or targets[{ume_ne_id|ne_id, commands}]. Do NOT loop one-NE calls for multi-NE work.", {
      ne_id: str2(),
      ume_ne_id: str2(),
      ne_ids: strArr("Managed NE ids for concurrent batch (shared commands)."),
      ume_ne_ids: strArr("UME inventory ne_ids for concurrent batch (shared commands)."),
      targets: {
        type: "array",
        description: "Per-NE command sets: each item is one NE (ne_id OR ume_ne_id) with commands[].",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            ne_id: str2(),
            ume_ne_id: str2(),
            commands: strArr()
          }
        }
      },
      commands: strArr("Commands for single NE, or shared commands for batch."),
      read_timeout_sec: num2("Per-command read timeout (default 60; use 90–120 for slow show)."),
      concurrency: num2("Parallel NEs for batch mode (1–8, default 4)."),
      async: bool2("oclaw-only async hint; ignored by native REST client.")
    }, execManagedNe, getClient, Math.max(t, 300000))),
    ctx.tools.register(tool("netx__listCliTargets", "List CLI-capable targets (managed NE and/or UME inventory). Call once per session with keyword/source, cache ids, then execManagedNe.", {
      source: str2("managed | ume | all"),
      keyword: str2(),
      page: num2(),
      page_size: num2()
    }, listCliTargets, getClient, t)),
    ctx.tools.register(tool("netx__findTopologyPaths", "Find up to max_paths simple paths between two fabric nodes. For each endpoint provide exactly one of ume_ne_id or managed_ne_id.", {
      from_ume_ne_id: str2(),
      from_managed_ne_id: str2(),
      to_ume_ne_id: str2(),
      to_managed_ne_id: str2(),
      max_paths: num2(),
      max_hops: num2(),
      layer: str2(),
      detail: str2("summary | full")
    }, findTopologyPaths, getClient, t))
  ];
  return () => {
    for (const dispose of disposers)
      dispose();
  };
}

// src/index.ts
var name = "netxops";
var inject = ["tools"];
var NETXOPS_SETTINGS_NAMESPACE = "netxops";
var NETXOPS_PRESET_ID = "netxops";
var DEFAULT_TOKEN_REF = "NETX_API_TOKEN";
var Config = z.object({
  apiUrl: z.string().default("http://127.0.0.1:8890"),
  lang: z.string().default("zh"),
  tokenCredentialRef: z.string().role("credential-ref").default(DEFAULT_TOKEN_REF),
  toolCallTimeoutMs: z.number().step(1).min(1000).default(120000),
  installAgentPreset: z.boolean().default(true)
});
function packageRoot() {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}
function resolveDshHome() {
  const fromEnv = process.env.DSH_HOME?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0)
    return fromEnv;
  return join(homedir(), ".dsh");
}
function ensureAgentPresetInstalled(logger) {
  const src = join(packageRoot(), "presets", NETXOPS_PRESET_ID);
  const composition = join(src, "agent.cordis.yml");
  if (!existsSync(composition)) {
    logger.warn("netxops: bundled preset missing at %s — skip user-preset install", src);
    return;
  }
  const destParent = join(resolveDshHome(), ".agent-presets");
  const dest = join(destParent, NETXOPS_PRESET_ID);
  try {
    mkdirSync(destParent, { recursive: true });
    if (existsSync(dest)) {
      rmSync(dest, { recursive: true, force: true });
    }
    cpSync(src, dest, { recursive: true });
    writeFileSync(join(dest, ".dsh-netxops-managed"), `${new Date().toISOString()}
`, "utf8");
    logger.info("netxops: agent preset installed at %s", dest);
  } catch (error) {
    logger.error("netxops: failed to install agent preset: %s", error);
  }
}
async function resolveToken(ctx, refName) {
  const credentials = ctx.get("credentials");
  if (credentials === undefined)
    return "";
  const hit = await credentials.resolve(credentialRef(refName));
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
  let unregister;
  let remounting = Promise.resolve();
  let generation = 0;
  if (config.installAgentPreset) {
    ensureAgentPresetInstalled(ctx.logger);
  }
  const remount = () => {
    remounting = remounting.then(async () => {
      const gen = ++generation;
      unregister?.();
      unregister = undefined;
      if (gen !== generation)
        return;
      const current = source();
      const token = await resolveToken(ctx, current.tokenCredentialRef);
      if (gen !== generation)
        return;
      unregister = registerNetxTools(ctx, {
        apiUrl: current.apiUrl.replace(/\/$/, ""),
        token,
        lang: current.lang,
        toolCallTimeoutMs: current.toolCallTimeoutMs
      });
      ctx.logger.info("netxops: registered netx__* REST tools → %s", current.apiUrl.replace(/\/$/, ""));
    }).catch((error) => {
      ctx.logger.error("netxops: remount error: %s", error);
    });
  };
  remount();
  installNetxopsSettings(ctx, config, {
    setSource: (current) => {
      source = current;
    },
    onChange: () => {
      remount();
    }
  });
  ctx.on("credentials/reference-updated", (ref) => {
    if (String(ref) === source().tokenCredentialRef)
      remount();
  });
  ctx.effect(() => () => {
    generation += 1;
    unregister?.();
    unregister = undefined;
  }, "netxops: dispose netx tools");
}
export {
  name,
  inject,
  ensureAgentPresetInstalled,
  apply,
  NETXOPS_SETTINGS_NAMESPACE,
  NETXOPS_PRESET_ID,
  DEFAULT_TOKEN_REF,
  Config
};
