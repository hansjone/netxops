// src/netx/group-tools-plugin.ts
import { readFileSync as readFileSync6 } from "node:fs";
import { dirname as dirname6, join as join10 } from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";

// src/netx/config-values.ts
var volatileWrite = Symbol.for("cosmokit.volatile.write");
function readConfigValue(value) {
  if (value !== null && typeof value === "object" && volatileWrite in value && "get" in value && typeof value.get === "function") {
    return value.get();
  }
  return value;
}
function readConfigSnapshot(input) {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, readConfigValue(value)]));
}

// src/netx/capability-groups.ts
var DEFAULT_CAPABILITY_GROUPS = Object.freeze({
  ops: Object.freeze({ inPreset: true, public: false }),
  topology: Object.freeze({ inPreset: false, public: false }),
  bizMonitor: Object.freeze({ inPreset: true, public: false })
});
var SKILL_DIR_BY_GROUP = Object.freeze({
  ops: "ops",
  topology: "topology",
  bizMonitor: "biz-monitor"
});
var CAPABILITY_GROUP_IDS = Object.freeze([
  "ops",
  "topology",
  "bizMonitor"
]);
function kbEnabledForPlane(flags, plane, presetId = "netxops") {
  if (flags)
    flags = readConfigSnapshot(flags);
  if (flags?.toolsEnabled === false)
    return false;
  if (!flags)
    return plane === "preset";
  if (plane === "preset") {
    return !flags.groupKbPublic && (presetId === "netxops" ? flags.groupKbInPreset !== false : parsePresetIds(flags.groupKbPresets ?? "").includes(presetId));
  }
  return flags.groupKbPublic === true;
}
function groupsForPlane(groups, plane, only) {
  const policy = groups ?? DEFAULT_CAPABILITY_GROUPS;
  const enabled = CAPABILITY_GROUP_IDS.filter((id) => {
    if (plane === "preset")
      return policy[id].inPreset;
    return policy[id].public;
  });
  if (!only || only.length === 0)
    return enabled;
  const allow = new Set(only);
  return enabled.filter((id) => allow.has(id));
}
function parsePresetIds(value) {
  const current = readConfigValue(value);
  if (typeof current !== "string")
    return [];
  return [...new Set(current.split(/[\s,，]+/).filter(Boolean))];
}
function groupsForPreset(connection, presetId, only) {
  if (connection.toolsEnabled === false)
    return [];
  const policy = connection.groups ?? DEFAULT_CAPABILITY_GROUPS;
  return CAPABILITY_GROUP_IDS.filter((id) => (!only?.length || only.includes(id)) && !policy[id].public && (presetId === "netxops" ? policy[id].inPreset : policy[id].presets?.includes(presetId)));
}

// src/netx/mcp-types.ts
var NETX_TOOL_PREFIX = "netx__";
function publicToolName(serverName) {
  return `${NETX_TOOL_PREFIX}${serverName}`;
}

// src/netx/mcp-catalog.ts
function disabledSet(disabledTools) {
  const out = new Set;
  for (const name of disabledTools ?? []) {
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (trimmed)
      out.add(trimmed);
  }
  return out;
}
function filterCatalogTools(catalog, enabledGroups, policy) {
  const allowGroups = new Set(enabledGroups);
  const disabled = disabledSet(policy.disabledTools);
  const readOnlyOnly = policy.readOnlyOnly === true;
  const out = [];
  for (const tool of catalog) {
    if (!tool.group || !allowGroups.has(tool.group))
      continue;
    if (disabled.has(tool.name))
      continue;
    if (readOnlyOnly && tool.readOnlyHint !== true)
      continue;
    out.push(tool);
  }
  return out;
}
function resolveEnabledTools(catalog, options) {
  if (options.toolsEnabled === false)
    return [];
  const enabledGroups = options.forceGroups ?? (options.plane === "preset" ? groupsForPreset({ toolsEnabled: options.toolsEnabled, groups: options.groups }, options.presetId ?? "netxops", options.only) : groupsForPlane(options.groups, options.plane, options.only));
  return filterCatalogTools(catalog, enabledGroups, options);
}
function disabledPublicNames(catalog, enabledGroups, disabledTools, readOnlyOnly) {
  const allowGroups = new Set(enabledGroups);
  const disabled = disabledSet(disabledTools);
  const names = [];
  for (const tool of catalog) {
    if (!tool.group || !allowGroups.has(tool.group))
      continue;
    const off = disabled.has(tool.name) || readOnlyOnly === true && tool.readOnlyHint !== true;
    if (off)
      names.push(publicToolName(tool.name));
  }
  return names.sort();
}

// src/netx/mcp-remote.ts
var PROTOCOL_VERSION = "2025-03-26";
var CLIENT_INFO = { name: "dsh-netxops", version: "0.1.71" };

class McpRemoteError extends Error {
  status;
  constructor(message, status) {
    super(message);
    this.name = "McpRemoteError";
    this.status = status;
  }
}
function mcpEndpointUrl(apiUrl) {
  const trimmed = apiUrl.trim().replace(/\/$/, "");
  if (!trimmed)
    return "";
  return `${trimmed}/mcp`;
}
function parseMcpResponseBody(raw) {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text)
    throw new McpRemoteError("empty /mcp response body");
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new McpRemoteError(`mcp JSON parse failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (text.includes("data:")) {
    const dataLines = [];
    for (const line of text.split(/\r?\n/)) {
      if (line.startsWith("data:"))
        dataLines.push(line.slice(5).trim());
    }
    for (let i = dataLines.length - 1;i >= 0; i -= 1) {
      try {
        return JSON.parse(dataLines[i]);
      } catch {}
    }
  }
  throw new McpRemoteError("mcp response was not JSON");
}
function asRpcResult(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new McpRemoteError("invalid JSON-RPC envelope from /mcp");
  }
  const row = payload;
  if (row.error && typeof row.error === "object" && !Array.isArray(row.error)) {
    const err = row.error;
    const message = typeof err.message === "string" ? err.message : "JSON-RPC error";
    throw new McpRemoteError(message);
  }
  if (!("result" in row)) {
    throw new McpRemoteError("JSON-RPC response missing result");
  }
  return payload.result;
}
var nextId = 1;
async function postRpc(options, method, params, notification = false) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream"
  };
  const token = options.token.trim();
  if (token)
    headers.Authorization = `Bearer ${token}`;
  const lang = options.lang?.trim();
  if (lang) {
    headers["Accept-Language"] = lang.toLowerCase().startsWith("en") ? "en" : "zh";
  }
  const body = notification ? { jsonrpc: "2.0", method, ...params ? { params } : {} } : { jsonrpc: "2.0", id: nextId++, method, ...params ? { params } : {} };
  const bodyText = JSON.stringify(body);
  const timeoutMs = typeof options.timeoutMs === "number" && options.timeoutMs > 0 ? options.timeoutMs : 60000;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new McpRemoteError("fetch is not available");
  }
  const abort = new AbortController;
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  const onOuterAbort = () => {
    abort.abort();
  };
  options.signal?.addEventListener("abort", onOuterAbort, { once: true });
  let response;
  try {
    response = await fetchImpl(options.mcpUrl, {
      method: "POST",
      headers,
      body: bodyText,
      signal: abort.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new McpRemoteError("mcp http timeout");
    }
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onOuterAbort);
  }
  const responseText = await response.text();
  if (response.status === 401 || response.status === 403) {
    throw new McpRemoteError(`HTTP ${response.status} unauthorized`, response.status);
  }
  if (response.status < 200 || response.status >= 300) {
    throw new McpRemoteError(`HTTP ${response.status}${responseText ? `: ${responseText.slice(0, 200)}` : ""}`, response.status);
  }
  if (notification) {
    return;
  }
  return asRpcResult(parseMcpResponseBody(responseText));
}
async function callMcpTool(options, name, args) {
  if (!options.mcpUrl)
    throw new McpRemoteError("mcp url is empty");
  await postRpc(options, "initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: CLIENT_INFO
  });
  await postRpc(options, "notifications/initialized", {}, true);
  const result = await postRpc(options, "tools/call", {
    name,
    arguments: args
  });
  const content = Array.isArray(result.content) ? result.content : [];
  return {
    content,
    ...result.structuredContent !== undefined ? { structuredContent: result.structuredContent } : {},
    ...result.isError === true ? { isError: true } : {}
  };
}
function mcpContentText(content, fallback = "") {
  const parts = [];
  for (const block of content) {
    if (!block || typeof block !== "object" || Array.isArray(block))
      continue;
    const row = block;
    if (row.type === "text" && typeof row.text === "string")
      parts.push(row.text);
  }
  return parts.join(`
`) || fallback;
}

// src/netx/mcp-store.ts
var STORE_KEY = Symbol.for("dsh-netxops.mcp-catalog-store");
var EMPTY = Object.freeze({
  phase: "idle",
  mcpUrl: "",
  tools: Object.freeze([]),
  error: "",
  listedAt: null,
  fromCache: false
});
function store() {
  const root = globalThis;
  let current = root[STORE_KEY];
  if (current === undefined) {
    current = { state: EMPTY, listeners: new Set, generation: 0 };
    root[STORE_KEY] = current;
  }
  return current;
}
function getMcpCatalogTools() {
  return store().state.tools;
}
function watchMcpCatalog(listener) {
  const state = store();
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
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
  const checkout = [join(here, "..", ".git"), join(here, "..", "..", ".git")].some(existsSync);
  const siblingCandidates = [
    join(here, "..", "..", "..", "netx", "skills"),
    join(here, "..", "..", "netx", "skills")
  ];
  for (const candidate of checkout ? siblingCandidates : []) {
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
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, `
`).replace(/\r/g, `
`);
  if (!text.startsWith("---"))
    return;
  const end = text.indexOf(`
---`, 3);
  if (end < 0)
    return;
  const yaml = text.slice(3, end).replace(/^\n/, "");
  const body = text.slice(end + 4).replace(/^\n/, "");
  const data = {};
  const lines = yaml.split(`
`);
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
    return { skills: [], skipped: [{ directory: groupDir, reason: "missing group dir" }] };
  }
  const skills = [];
  const skipped = [];
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
    const skillPath = join(full, "SKILL.md");
    let raw;
    try {
      raw = await readFile(skillPath, "utf8");
    } catch {
      skipped.push({ directory: full, reason: "no SKILL.md" });
      continue;
    }
    const parsed = parseFrontmatter(raw);
    if (!parsed) {
      skipped.push({ directory: full, reason: "invalid frontmatter" });
      continue;
    }
    const name = typeof parsed.data.name === "string" ? parsed.data.name.trim() : "";
    const description = typeof parsed.data.description === "string" ? parsed.data.description.trim() : "";
    if (!name || !description) {
      skipped.push({
        directory: full,
        reason: !name ? "missing name" : "missing description"
      });
      continue;
    }
    skills.push({
      name,
      description,
      content: parsed.body.trimStart(),
      path: skillPath,
      directory: full
    });
  }
  return { skills, skipped };
}
function disabledFootnote(names, lang) {
  if (names.length === 0)
    return "";
  const list = names.join(", ");
  const en = (lang ?? "").trim().toLowerCase().startsWith("en");
  return en ? `

## Disabled tools
The following tools are disabled: ${list}. Do not call them.
` : `

## 已禁用工具
以下工具已禁用：${list}，不要调用。
`;
}
async function registerGroupSkills(ctx, groupIds, providerLabel, signalOrOptions) {
  const options = signalOrOptions instanceof AbortSignal || signalOrOptions === undefined ? { signal: signalOrOptions } : signalOrOptions;
  const signal = options.signal;
  const skillsApi = ctx.skills;
  if (!skillsApi || typeof skillsApi.register !== "function") {
    return () => {};
  }
  const root = opsSkillsRoot();
  const disposers = [];
  const enabled = new Set(groupIds);
  const log = ctx.logger;
  try {
    for (const groupId of CAPABILITY_GROUP_IDS) {
      if (!enabled.has(groupId))
        continue;
      const { skills, skipped } = await loadGroupSkills(root, groupId);
      if (signal?.aborted)
        break;
      for (const miss of skipped) {
        log?.warn?.("%s: skip skill dir %s (%s)", providerLabel, miss.directory, miss.reason);
      }
      if (skills.length === 0) {
        log?.warn?.("%s: no skills loaded for group=%s from %s", providerLabel, groupId, join(root, SKILL_DIR_BY_GROUP[groupId]));
      }
      const footnote = disabledFootnote(options.disabledByGroup?.[groupId] ?? [], options.lang);
      for (const skill of skills) {
        const base = groupId === "topology" ? `${skill.content}

## DeepSeek Harness REST capabilities
Use only tools present in this session. Dual-unit/orbit/polish recipes require server-side topology tools. Use only tools present in this session.
` : skill.content;
        disposers.push(skillsApi.register({
          name: skill.name,
          description: skill.description,
          content: `${base}${footnote}`,
          path: skill.path,
          resourceBase: { kind: "directory", path: skill.directory },
          provider: providerLabel,
          source: "custom"
        }));
      }
    }
    if (signal?.aborted) {
      for (const dispose of disposers.splice(0))
        dispose();
    }
  } catch (error) {
    for (const dispose of disposers.splice(0))
      dispose();
    throw error;
  }
  return () => {
    for (const dispose of disposers)
      dispose();
  };
}

// src/netx/kb-context-skill.ts
import { readdirSync as readdirSync2, readFileSync as readFileSync2, statSync as statSync3 } from "node:fs";
import { join as join4 } from "node:path";

// src/netx/kb-manifest.ts
import { existsSync as existsSync2, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname as dirname2, join as join2, resolve } from "node:path";
var EMPTY_CONTENT = {
  hasRegions: false,
  hasTheory: false,
  hasPacket: false,
  hasCommon: false,
  hasSkills: false
};
function unconfiguredKbSnapshot() {
  return {
    status: "unconfigured",
    realRoot: "",
    operatorName: "",
    country: "",
    version: "",
    content: { ...EMPTY_CONTENT },
    paths: {},
    errorMessage: ""
  };
}
function resolveKbPaths(snapshot) {
  if (snapshot.status !== "configured")
    return [];
  const paths = { skills: "_skills", ...snapshot.paths };
  return Object.entries(paths).filter((entry) => typeof entry[1] === "string" && entry[1].trim() !== "").map(([key, rel]) => {
    const absolute = resolve(snapshot.realRoot, rel);
    return { key, relative: rel, absolute, exists: existsSync2(absolute) };
  });
}
function renderKbPathTable(snapshot) {
  const rows = resolveKbPaths(snapshot);
  if (rows.length === 0)
    return "(MANIFEST has no paths — legacy package; ask HQ for a repack)";
  return [
    "| paths.* | Absolute path |",
    "| --- | --- |",
    ...rows.map((row) => `| ${row.key} | \`${row.absolute}\`${row.exists ? "" : " (missing)"} |`)
  ].join(`
`);
}

// src/netx/kb-local-path.ts
import { existsSync as existsSync3, realpathSync, statSync as statSync2 } from "node:fs";
import { join as join3, relative, resolve as resolve2, sep } from "node:path";
var KB_LOCAL_WRITABLE_ROOTS = Object.freeze([
  "memories",
  "drafts",
  "suggestions",
  "refs"
]);
var REF_AREAS = Object.freeze([
  "inventory",
  "devices",
  "topology",
  "business",
  "commands",
  "handbooks"
]);
var MEMORY_BUCKET_DIR = Object.freeze({
  note: "日常笔记",
  rca_review: "排障复盘",
  ai_trace: "AI思维链"
});
function resolveKbLocalRoot(snapshot) {
  if (snapshot.status !== "configured")
    return null;
  const rel = snapshot.paths.local?.trim();
  if (!rel)
    return null;
  return resolve2(snapshot.realRoot, rel);
}
function sanitizeSlug(raw, fallback = "entry") {
  const cleaned = raw.trim().replace(/[/\\]+/g, "-").replace(/\.\.+/g, "").replace(/[^\w.\u4e00-\u9fff-]+/gu, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned || fallback;
}
function todayIsoDate(now = new Date) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function toCompactDate(isoOrEmpty, now = new Date) {
  const iso = (isoOrEmpty?.trim() || todayIsoDate(now)).replace(/-/g, "");
  if (!/^\d{8}$/.test(iso)) {
    throw new Error(`invalid date (want YYYY-MM-DD or YYYYMMDD): ${isoOrEmpty}`);
  }
  return iso;
}
function normalizeIsoDate(raw, now = new Date) {
  const t = raw?.trim();
  if (!t)
    return todayIsoDate(now);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t))
    return t;
  if (/^\d{8}$/.test(t)) {
    return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
  }
  throw new Error(`invalid date (want YYYY-MM-DD or YYYYMMDD): ${raw}`);
}
function memoryFileName(opts) {
  const date = normalizeIsoDate(opts.date, opts.now);
  return `${date}-${sanitizeSlug(opts.slug)}.md`;
}
function draftFileName(opts) {
  const compact = toCompactDate(opts.date, opts.now);
  const slug = sanitizeSlug(opts.slug);
  const base = slug.toUpperCase().startsWith("DRAFT-") ? slug : `DRAFT-${compact}-${slug}`;
  return base.toLowerCase().endsWith(".md") ? base : `${base}.md`;
}
function suggestionFileName(opts) {
  const date = normalizeIsoDate(opts.date, opts.now);
  return `${date}-${sanitizeSlug(opts.slug)}.md`;
}
function refFileName(slug) {
  const base = sanitizeSlug(slug, "note");
  return base.toLowerCase().endsWith(".md") ? base : `${base}.md`;
}
function resolveWritableLocalPath(localRoot, ...segments) {
  if (segments.some((s) => s.includes("\x00"))) {
    throw new Error("path segment contains NUL");
  }
  const absolutePath = resolve2(localRoot, ...segments);
  const rel = relative(localRoot, absolutePath);
  if (!rel || rel.startsWith("..") || rel.split(/[/\\]/).includes("..")) {
    throw new Error(`path escapes local root: ${absolutePath}`);
  }
  const top = rel.split(/[/\\]/)[0];
  if (!KB_LOCAL_WRITABLE_ROOTS.includes(top)) {
    throw new Error(`writes only allowed under ${KB_LOCAL_WRITABLE_ROOTS.join("|")}/ (got ${top}/)`);
  }
  return {
    absolutePath,
    relativePath: rel.split(sep).join("/"),
    writableRoot: top
  };
}
function resolveExistingWritableFile(localRoot, pathArg) {
  const trimmed = pathArg.trim();
  if (!trimmed)
    throw new Error("path is empty");
  const candidate = resolve2(trimmed);
  let absolutePath;
  const localResolved = resolve2(localRoot);
  const underLocal = candidate === localResolved || candidate.startsWith(localResolved + sep);
  if (underLocal) {
    absolutePath = candidate;
  } else {
    absolutePath = resolve2(localRoot, trimmed);
  }
  const checked = resolveWritableLocalPath(localRoot, ...relative(localRoot, absolutePath).split(/[/\\]/).filter(Boolean));
  try {
    if (existsSync3(checked.absolutePath)) {
      const realFile = realpathSync(checked.absolutePath);
      const realLocal = realpathSync(localRoot);
      const realRel = relative(realLocal, realFile);
      if (!realRel || realRel.startsWith("..") || realRel.split(/[/\\]/).includes("..")) {
        throw new Error(`path escapes local root after realpath: ${realFile}`);
      }
      const top = realRel.split(/[/\\]/)[0];
      if (!KB_LOCAL_WRITABLE_ROOTS.includes(top)) {
        throw new Error(`path not under writable roots: ${realRel}`);
      }
      if (!statSync2(realFile).isFile()) {
        throw new Error(`not a file: ${realFile}`);
      }
      return {
        absolutePath: realFile,
        relativePath: realRel.split(sep).join("/"),
        writableRoot: top
      };
    }
  } catch (error) {
    if (error instanceof Error && /escapes|writable|not a file/.test(error.message)) {
      throw error;
    }
  }
  return checked;
}
function memoryDir(bucket) {
  return join3("memories", MEMORY_BUCKET_DIR[bucket]);
}
function suggestionDir(kind) {
  return join3("suggestions", kind);
}
function draftDir(domain) {
  const d = domain?.trim();
  if (!d)
    return "drafts";
  return join3("drafts", sanitizeSlug(d, "misc"));
}
function refDir(area, device) {
  if (!REF_AREAS.includes(area)) {
    throw new Error(`invalid refs area: ${area}`);
  }
  if (area === "devices") {
    const host = sanitizeSlug(device?.trim() || "", "");
    if (!host) {
      throw new Error("refs/devices requires device (host_name)");
    }
    return join3("refs", "devices", host);
  }
  return join3("refs", area);
}

// src/netx/kb-context-skill.ts
var SKILL_NAME = "kb-context";
var IDENTITY_FILE_MAX = 8000;
var IDENTITY_TOTAL_MAX = 24000;
function readKbIdentity(snapshot) {
  const localRoot = resolveKbLocalRoot(snapshot);
  if (!localRoot)
    return [];
  const dir = join4(localRoot, "identity");
  let names;
  try {
    names = readdirSync2(dir).filter((name) => /\.md$/i.test(name) && !/^readme\.md$/i.test(name)).sort();
  } catch {
    return [];
  }
  const out = [];
  let budget = IDENTITY_TOTAL_MAX;
  for (const name of names) {
    if (budget <= 0)
      break;
    const full = join4(dir, name);
    let text;
    try {
      if (!statSync3(full).isFile())
        continue;
      text = readFileSync2(full, "utf8").replace(/^\uFEFF/, "").trim();
    } catch {
      continue;
    }
    if (!text)
      continue;
    const cap = Math.min(IDENTITY_FILE_MAX, budget);
    if (text.length > cap)
      text = `${text.slice(0, cap)}

…(truncated — read \`${full}\` for the rest)`;
    budget -= text.length;
    out.push({ name, text });
  }
  return out;
}
function skillBody(snapshot) {
  if (snapshot.status === "configured") {
    const flags = Object.entries(snapshot.content).filter(([, on]) => on).map(([key]) => key).join(", ") || "(none)";
    const localRoot = resolveKbLocalRoot(snapshot);
    const localRow = localRoot ? `| kbLocal | \`${localRoot}\` |` : "| kbLocal | (MANIFEST paths.local missing) |";
    const identity = readKbIdentity(snapshot);
    const identityBlock = identity.length > 0 ? [
      "",
      "### Site identity (`identity/`, authoritative — follow over generic advice)",
      ...identity.flatMap(({ name, text }) => ["", `#### ${name}`, "", text])
    ] : [];
    const localGuide = localRoot ? [
      "",
      "### Dual plane (mandatory)",
      "",
      "- **HQ pack = read-only** (formal RCA, theory, packet, `_common`, `_skills`, shared cmdLib).",
      `- **Writable evolution core**: \`${localRoot}\` → \`refs/\` | \`memories/\` | \`drafts/\` | \`suggestions/\`.`,
      "- **All KB writes via host tools** (workspace Write/bash cannot reach KB):",
      "  `netx__kbWriteRef` / `netx__kbWriteMemory` / `netx__kbWriteDraft` / `netx__kbWriteSuggestion` /",
      "  `netx__kbUpdateLocal` / `netx__kbDeleteLocal` / `netx__kbListLocal`.",
      "",
      "### refs — site product knowledge (evolve every task)",
      "- On any NE: **read** `refs/devices/<host_name>/` first; if missing, prove with netx then `kbWriteRef` to create/update.",
      "- `area=devices` requires `device=<host_name>` (never UUID); primary file slug=`PROFILE`.",
      "- Also: `inventory` (ledger), `topology`, `business`, `commands` (site-only), `handbooks`.",
      "- Device facts → refs; episodic experience → memories (do not dump ledgers into diaries).",
      "",
      "### memories — write immediately when valuable",
      "- `bucket=note` | `rca_review` | `ai_trace` — short beats lost.",
      "- Open cases → `kbWriteDraft`. HQ pack gaps → `kbWriteSuggestion`."
    ] : [
      "",
      "No local write tools until `paths.local` is present in MANIFEST."
    ];
    return {
      description: `Load FIRST before any kb-* skill or KB file access: resolved absolute paths (rca / theory / packet / neIndex / cmdLib / local …) for operator ${snapshot.operatorName} (${snapshot.country}) KB v${snapshot.version}, site identity rules, and KB write rules.`,
      content: [
        "## Knowledge base (configured)",
        "",
        "When troubleshooting with operator playbooks or docs, **compose paths from this root**.",
        "Do not invent another operator or country.",
        "",
        `| Field | Value |`,
        `| --- | --- |`,
        `| kbStatus | configured |`,
        `| kbRoot | \`${snapshot.realRoot}\` |`,
        localRow,
        `| kbOperator | ${snapshot.operatorName} |`,
        `| kbCountry | ${snapshot.country} |`,
        `| kbVersion | ${snapshot.version} |`,
        `| kbContent (on) | ${flags} |`,
        "",
        "### Path anchors (resolved from MANIFEST `paths.*` — use verbatim, never compose `regions/<country>/<operator>/…`)",
        "",
        renderKbPathTable(snapshot),
        ...identityBlock,
        ...localGuide,
        "",
        "### Reading the HQ pack",
        "- `netx__kbSearch` — keyword/regex search across rca / theory / packet / common / local (returns file + line hits).",
        "- `netx__kbRead` — read one KB file (path relative to kbRoot or absolute inside it; optional line window).",
        "- Start from the indexes: `neIndex` (NE → cases), `patternMap`, `classification`, then open the cited RCA.",
        "",
        "Environment mirrors: KB_ROOT, KB_LOCAL, KB_OPERATOR, KB_COUNTRY, KB_VERSION, KB_CONTENT, KB_PATHS (JSON of the anchors above), KB_STATUS.",
        "",
        "Business playbooks (kb-troubleshoot, kb-retrieve, …) register from paths.skills",
        "when hasSkills is true, plus paths.localSkills when present — use those skills for KB triage;",
        "keep netx-ops for live netx evidence only."
      ].join(`
`)
    };
  }
  const reason = snapshot.status === "error" ? snapshot.errorMessage || "invalid knowledge base" : "kbRoot is empty";
  return {
    description: "Knowledge-base context is unavailable — stay on pure netx evidence.",
    content: [
      "## Knowledge base (unavailable)",
      "",
      `kbStatus=${snapshot.status}. ${reason}`,
      "",
      "**Do not invent an operator, country, or KB paths.**",
      "Use only netx tools / live evidence (alarms, inventory, CLI, topology).",
      "Operator-specific playbooks are out of scope until a valid MANIFEST is configured."
    ].join(`
`)
  };
}
function registerKbContextSkill(ctx, snapshot) {
  const skillsApi = ctx.skills;
  if (!skillsApi || typeof skillsApi.register !== "function") {
    return () => {};
  }
  const body = skillBody(snapshot);
  return skillsApi.register({
    name: SKILL_NAME,
    description: body.description,
    content: body.content,
    provider: "netxops-kb",
    source: "custom"
  });
}

// src/netx/kb-local-tools.ts
import { defineTool } from "@deepseek-ai/dsh-tools";

// src/netx/kb-local-ops.ts
import {
  existsSync as existsSync4,
  mkdirSync,
  readdirSync as readdirSync3,
  readFileSync as readFileSync3,
  rmSync,
  statSync as statSync4,
  writeFileSync
} from "node:fs";
import { dirname as dirname3, join as join5 } from "node:path";
function requireLocalRoot(snapshot) {
  const root = resolveKbLocalRoot(snapshot);
  if (!root) {
    throw new Error("KB local root unavailable (configure kbRoot + MANIFEST paths.local)");
  }
  return root;
}
function ensureDraftBody(body) {
  const trimmed = body.replace(/^\uFEFF/, "");
  if (/^---\r?\n[\s\S]*?\r?\nstatus:\s*draft\b/m.test(trimmed) || /^---\r?\n[\s\S]*?\nstatus:\s*["']?draft["']?\s*$/m.test(trimmed)) {
    return trimmed.endsWith(`
`) ? trimmed : `${trimmed}
`;
  }
  if (trimmed.startsWith("---")) {
    const end = trimmed.indexOf(`
---`, 3);
    if (end !== -1) {
      const fm = trimmed.slice(0, end + 4);
      const rest = trimmed.slice(end + 4);
      if (/\nstatus:\s*/.test(fm))
        return trimmed.endsWith(`
`) ? trimmed : `${trimmed}
`;
      const injected = fm.replace(/^---\r?\n/, `---
status: draft
`);
      const out = `${injected}${rest}`;
      return out.endsWith(`
`) ? out : `${out}
`;
    }
  }
  return `---
status: draft
---

${trimmed.endsWith(`
`) ? trimmed : `${trimmed}
`}`;
}
function createMemory(snapshot, args) {
  const localRoot = requireLocalRoot(snapshot);
  const name = memoryFileName({ date: args.date, slug: args.slug });
  const target = resolveWritableLocalPath(localRoot, memoryDir(args.bucket), name);
  if (existsSync4(target.absolutePath) && !args.overwrite) {
    throw new Error(`file already exists (pass overwrite=true to replace): ${target.relativePath}`);
  }
  mkdirSync(dirname3(target.absolutePath), { recursive: true });
  const existed = existsSync4(target.absolutePath);
  writeFileSync(target.absolutePath, args.body.endsWith(`
`) ? args.body : `${args.body}
`, "utf8");
  return {
    ok: true,
    action: existed ? "updated" : "created",
    absolutePath: target.absolutePath,
    relativePath: target.relativePath
  };
}
function createDraft(snapshot, args) {
  const localRoot = requireLocalRoot(snapshot);
  const name = draftFileName({ date: args.date, slug: args.slug });
  const target = resolveWritableLocalPath(localRoot, draftDir(args.domain), name);
  if (existsSync4(target.absolutePath) && !args.overwrite) {
    throw new Error(`file already exists (pass overwrite=true to replace): ${target.relativePath}`);
  }
  mkdirSync(dirname3(target.absolutePath), { recursive: true });
  const existed = existsSync4(target.absolutePath);
  writeFileSync(target.absolutePath, ensureDraftBody(args.body), "utf8");
  return {
    ok: true,
    action: existed ? "updated" : "created",
    absolutePath: target.absolutePath,
    relativePath: target.relativePath
  };
}
function createSuggestion(snapshot, args) {
  const localRoot = requireLocalRoot(snapshot);
  const name = suggestionFileName({ date: args.date, slug: args.slug });
  const target = resolveWritableLocalPath(localRoot, suggestionDir(args.kind), name);
  if (existsSync4(target.absolutePath) && !args.overwrite) {
    throw new Error(`file already exists (pass overwrite=true to replace): ${target.relativePath}`);
  }
  mkdirSync(dirname3(target.absolutePath), { recursive: true });
  const existed = existsSync4(target.absolutePath);
  writeFileSync(target.absolutePath, args.body.endsWith(`
`) ? args.body : `${args.body}
`, "utf8");
  return {
    ok: true,
    action: existed ? "updated" : "created",
    absolutePath: target.absolutePath,
    relativePath: target.relativePath
  };
}
function createRef(snapshot, args) {
  const localRoot = requireLocalRoot(snapshot);
  const name = refFileName(args.slug);
  const target = resolveWritableLocalPath(localRoot, refDir(args.area, args.device), name);
  if (existsSync4(target.absolutePath) && !args.overwrite) {
    throw new Error(`file already exists (pass overwrite=true to replace): ${target.relativePath}`);
  }
  mkdirSync(dirname3(target.absolutePath), { recursive: true });
  const existed = existsSync4(target.absolutePath);
  writeFileSync(target.absolutePath, args.body.endsWith(`
`) ? args.body : `${args.body}
`, "utf8");
  return {
    ok: true,
    action: existed ? "updated" : "created",
    absolutePath: target.absolutePath,
    relativePath: target.relativePath
  };
}
function updateLocalFile(snapshot, args) {
  const localRoot = requireLocalRoot(snapshot);
  const target = resolveExistingWritableFile(localRoot, args.path);
  if (!existsSync4(target.absolutePath)) {
    throw new Error(`file not found: ${target.relativePath}`);
  }
  const body = target.writableRoot === "drafts" ? ensureDraftBody(args.body) : args.body.endsWith(`
`) ? args.body : `${args.body}
`;
  writeFileSync(target.absolutePath, body, "utf8");
  return {
    ok: true,
    action: "updated",
    absolutePath: target.absolutePath,
    relativePath: target.relativePath
  };
}
function deleteLocalFile(snapshot, args) {
  const localRoot = requireLocalRoot(snapshot);
  const target = resolveExistingWritableFile(localRoot, args.path);
  if (!existsSync4(target.absolutePath)) {
    throw new Error(`file not found: ${target.relativePath}`);
  }
  rmSync(target.absolutePath, { force: false });
  return {
    ok: true,
    action: "deleted",
    absolutePath: target.absolutePath,
    relativePath: target.relativePath
  };
}
function walkFiles(dir, baseLocal, out) {
  let entries;
  try {
    entries = readdirSync3(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === "." || name === "..")
      continue;
    const full = join5(dir, name);
    let st;
    try {
      st = statSync4(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walkFiles(full, baseLocal, out);
    } else if (st.isFile() && name.toLowerCase().endsWith(".md")) {
      const rel = full.slice(baseLocal.length).replace(/^[/\\]/, "").split(/[/\\]/).join("/");
      out.push({
        absolutePath: full,
        relativePath: rel,
        mtimeMs: st.mtimeMs,
        size: st.size
      });
    }
  }
}
function listLocalFiles(snapshot, args = {}) {
  const localRoot = requireLocalRoot(snapshot);
  const roots = args.root && args.root !== "all" ? [args.root] : [...KB_LOCAL_WRITABLE_ROOTS];
  const entries = [];
  for (const r of roots) {
    walkFiles(join5(localRoot, r), localRoot, entries);
  }
  entries.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
  return {
    ok: true,
    localRoot,
    entries: entries.slice(0, limit)
  };
}

// src/netx/kb-read-ops.ts
import { readdirSync as readdirSync4, readFileSync as readFileSync4, realpathSync as realpathSync2, statSync as statSync5 } from "node:fs";
import { extname, join as join6, relative as relative2, resolve as resolve3, sep as sep2 } from "node:path";
var TEXT_EXTENSIONS = new Set([".md", ".markdown", ".txt", ".json", ".yml", ".yaml", ".csv", ".ps1", ".sh", ".cfg", ".conf", ".log"]);
var SKIP_DIRS = new Set([".git", "node_modules"]);
var READ_DEFAULT_LINES = 400;
var READ_MAX_LINES = 2000;
var READ_MAX_CHARS = 80000;
var SEARCH_MAX_FILE_BYTES = 2 * 1024 * 1024;
var SEARCH_HITS_PER_FILE = 4;
var CACHE_MAX_CHARS = 64 * 1024 * 1024;
function requireRoot(snapshot) {
  if (snapshot.status !== "configured" || !snapshot.realRoot) {
    throw new Error("knowledge base not configured (set kbRoot to a folder with MANIFEST.json)");
  }
  return snapshot.realRoot;
}
function toPosix(rel) {
  return rel.split(sep2).join("/");
}
function isInside(root, target) {
  const rel = relative2(root, target);
  return rel === "" || !rel.startsWith("..") && !rel.split(/[/\\]/).includes("..") && !/^[a-zA-Z]:/.test(rel);
}
function resolveKbReadPath(snapshot, pathArg) {
  const root = requireRoot(snapshot);
  const trimmed = pathArg.trim().replace(/^["']|["']$/g, "");
  if (trimmed.includes("\x00"))
    throw new Error("path contains NUL");
  const anchor = resolveKbPaths(snapshot).find((row) => row.key === trimmed);
  const candidate = anchor ? anchor.absolute : !trimmed || trimmed === "." || trimmed === "/" ? root : resolve3(root, trimmed);
  if (!isInside(root, candidate))
    throw new Error(`path escapes kbRoot: ${candidate}`);
  let real;
  try {
    real = realpathSync2(candidate);
  } catch {
    throw new Error(`not found in KB: ${toPosix(relative2(root, candidate)) || "."}`);
  }
  const realRoot = realpathSync2(root);
  if (!isInside(realRoot, real))
    throw new Error(`path escapes kbRoot after realpath: ${real}`);
  return { absolutePath: real, relativePath: toPosix(relative2(realRoot, real)) || "." };
}
function readKbFile(snapshot, args) {
  const target = resolveKbReadPath(snapshot, args.path);
  const st = statSync5(target.absolutePath);
  if (st.isDirectory()) {
    const entries = readdirSync4(target.absolutePath, { withFileTypes: true }).filter((entry) => !SKIP_DIRS.has(entry.name)).map((entry) => {
      if (entry.isDirectory())
        return { name: entry.name, type: "dir" };
      let size;
      try {
        size = statSync5(join6(target.absolutePath, entry.name)).size;
      } catch {}
      return { name: entry.name, type: "file", size };
    }).sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1);
    return { ok: true, kind: "directory", ...target, entries };
  }
  if (!TEXT_EXTENSIONS.has(extname(target.absolutePath).toLowerCase())) {
    throw new Error(`not a text KB file: ${target.relativePath}`);
  }
  const lines = readFileSync4(target.absolutePath, "utf8").replace(/^\uFEFF/, "").replace(/\r\n?/g, `
`).split(`
`);
  const start = Math.max(1, Math.floor(args.offset ?? 1));
  const limit = Math.min(Math.max(1, Math.floor(args.limit ?? READ_DEFAULT_LINES)), READ_MAX_LINES);
  let slice = lines.slice(start - 1, start - 1 + limit);
  let text = slice.join(`
`);
  let truncated = start - 1 + slice.length < lines.length;
  if (text.length > READ_MAX_CHARS) {
    let used = 0;
    let keep = 0;
    for (const line of slice) {
      if (used + line.length + 1 > READ_MAX_CHARS)
        break;
      used += line.length + 1;
      keep += 1;
    }
    slice = slice.slice(0, Math.max(keep, 1));
    text = slice.join(`
`).slice(0, READ_MAX_CHARS);
    truncated = true;
  }
  return {
    ok: true,
    kind: "file",
    ...target,
    totalLines: lines.length,
    startLine: start,
    endLine: start - 1 + slice.length,
    truncated,
    text
  };
}
var CACHE_KEY = Symbol.for("dsh-netxops.kb-search-cache");
function searchCache() {
  const root = globalThis;
  root[CACHE_KEY] ??= { files: new Map, chars: 0 };
  return root[CACHE_KEY];
}
function cachedText(path, mtimeMs, size) {
  const cache = searchCache();
  const hit = cache.files.get(path);
  if (hit && hit.mtimeMs === mtimeMs && hit.size === size)
    return hit;
  const text = readFileSync4(path, "utf8").replace(/^\uFEFF/, "");
  if (hit)
    cache.chars -= hit.text.length;
  if (cache.chars + text.length > CACHE_MAX_CHARS) {
    cache.files.clear();
    cache.chars = 0;
  }
  const entry = { mtimeMs, size, text, lower: text.toLowerCase() };
  cache.files.set(path, entry);
  cache.chars += text.length;
  return entry;
}
function walkTextFiles(dir, out) {
  let entries;
  try {
    entries = readdirSync4(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name))
      continue;
    const full = join6(dir, entry.name);
    if (entry.isDirectory()) {
      walkTextFiles(full, out);
      continue;
    }
    if (!entry.isFile() || !TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase()))
      continue;
    try {
      const st = statSync5(full);
      if (st.size <= SEARCH_MAX_FILE_BYTES)
        out.push({ path: full, mtimeMs: st.mtimeMs, size: st.size });
    } catch {}
  }
}
function searchKb(snapshot, args) {
  const root = requireRoot(snapshot);
  const query = args.query.trim();
  if (!query)
    throw new Error("query is empty");
  const scopeArg = args.scope?.trim() || "all";
  const scopes = scopeArg.split(/[,\s]+/).filter(Boolean);
  const dirs = scopes.includes("all") ? [root] : scopes.map((scope) => resolveKbReadPath(snapshot, scope).absolutePath);
  let matchers;
  if (args.regex) {
    let re;
    try {
      re = new RegExp(query, "i");
    } catch (error) {
      throw new Error(`invalid regex: ${error instanceof Error ? error.message : String(error)}`);
    }
    matchers = [{ term: query, test: (_lower, raw) => re.test(raw) }];
  } else {
    const terms = [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))];
    matchers = terms.map((term) => ({ term, test: (lower) => lower.includes(term) }));
  }
  const files = [];
  const seen = new Set;
  for (const dir of dirs) {
    const st = statSync5(dir);
    const batch = [];
    if (st.isFile())
      batch.push({ path: dir, mtimeMs: st.mtimeMs, size: st.size });
    else
      walkTextFiles(dir, batch);
    for (const file of batch) {
      if (seen.has(file.path))
        continue;
      seen.add(file.path);
      files.push(file);
    }
  }
  const hits = [];
  for (const file of files) {
    let cached;
    try {
      cached = cachedText(file.path, file.mtimeMs, file.size);
    } catch {
      continue;
    }
    const rel = toPosix(relative2(root, file.path));
    const matched = new Set;
    let score = 0;
    for (const m of matchers) {
      if (m.test(rel.toLowerCase(), rel)) {
        matched.add(m.term);
        score += 3;
      }
    }
    const inBody = matchers.filter((m) => m.test(cached.lower, cached.text));
    if (inBody.length === 0 && matched.size === 0)
      continue;
    const lines = [];
    const rows = inBody.length > 0 ? cached.text.split(/\r\n?|\n/) : [];
    let lineHits = 0;
    for (let i = 0;i < rows.length; i += 1) {
      const row = rows[i];
      const lower = row.toLowerCase();
      let lineHit = false;
      for (const m of inBody) {
        if (m.test(lower, row)) {
          matched.add(m.term);
          lineHit = true;
        }
      }
      if (!lineHit)
        continue;
      lineHits += 1;
      if (lines.length < SEARCH_HITS_PER_FILE) {
        const trimmed = row.trim();
        lines.push({ line: i + 1, text: trimmed.length > 240 ? `${trimmed.slice(0, 240)}…` : trimmed });
      }
    }
    score += matched.size * 10 + Math.min(lineHits, 30) * 0.1;
    hits.push({
      relativePath: rel,
      absolutePath: file.path,
      score: Math.round(score * 10) / 10,
      matchedTerms: [...matched],
      lines
    });
  }
  hits.sort((a, b) => b.score - a.score || a.relativePath.localeCompare(b.relativePath));
  const limit = Math.min(Math.max(Math.floor(args.limit ?? 20), 1), 100);
  return { ok: true, scope: scopeArg, scannedFiles: files.length, totalMatches: hits.length, hits: hits.slice(0, limit) };
}

// src/netx/kb-runtime.ts
var STORE_KEY2 = Symbol.for("dsh-netxops.kb-store");
function store2() {
  const root = globalThis;
  let current = root[STORE_KEY2];
  if (current === undefined) {
    current = { snapshot: unconfiguredKbSnapshot(), listeners: new Set };
    root[STORE_KEY2] = current;
  }
  return current;
}
function getKbContext() {
  const snap = store2().snapshot;
  return {
    ...snap,
    content: { ...snap.content },
    paths: { ...snap.paths }
  };
}
function watchKbContext(listener) {
  const state = store2();
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

// src/netx/json-safe.ts
function toLosslessJson(value) {
  try {
    const text = JSON.stringify(value);
    if (text === undefined) {
      return { ok: false, error: "tool_result_not_json", detail: "undefined_root" };
    }
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
    return { ok: true, data: { value: parsed } };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, error: "tool_result_not_json", detail: detail.slice(0, 400) };
  }
}

// src/netx/tool-mount-status.ts
import { mkdirSync as mkdirSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { homedir } from "node:os";
import { dirname as dirname4, join as join7 } from "node:path";
var KEY = Symbol.for("dsh-netxops.mount-inventory");
function store3() {
  const root = globalThis;
  return root[KEY] ??= { mounts: new Map, contexts: new WeakMap, sequence: 0 };
}
function getToolMountId(ctx, source) {
  const state = store3();
  let id = state.contexts.get(ctx);
  if (id === undefined) {
    id = ++state.sequence;
    state.contexts.set(ctx, id);
  }
  return `${source}:${id}`;
}
function getToolMountStatuses() {
  return [...store3().mounts.values()].map((row) => ({ ...row, groups: [...row.groups], names: [...row.names] }));
}
function getToolMountStatus() {
  const rows = getToolMountStatuses();
  return rows.find((row) => row.plane === "host") ?? rows.at(-1);
}
function persist() {
  try {
    const path = join7(process.env.DSH_HOME?.trim() || join7(homedir(), ".dsh"), "netxops-mount-status.json");
    mkdirSync2(dirname4(path), { recursive: true });
    writeFileSync2(path, `${JSON.stringify({ mount: getToolMountStatus() ?? null, mounts: getToolMountStatuses() }, null, 2)}
`, "utf8");
  } catch {}
}
function publishToolMountStatus(next) {
  store3().mounts.set(next.id ?? next.source ?? next.plane, { ...next, groups: [...next.groups], names: [...next.names] });
  persist();
}
function removeToolMountStatus(id) {
  store3().mounts.delete(id);
  persist();
}

// src/netx/kb-local-tools.ts
var str = (description) => ({ type: "string", ...description ? { description } : {} });
var bool = (description) => ({ type: "boolean", ...description ? { description } : {} });
var num = (description) => ({ type: "number", ...description ? { description } : {} });
var reqStr = (description) => ({
  type: "string",
  required: true,
  ...description ? { description } : {}
});
function renderJson(_args, value) {
  return [{ type: "text", text: JSON.stringify(value, null, 0) }];
}
var jsonOut = {
  schema: { type: "object", additionalProperties: true },
  render: renderJson
};
function liveSnapshot() {
  return getKbContext();
}
function tool(name, description, parameters, execute) {
  return defineTool({
    name,
    description,
    parameters,
    output: jsonOut,
    timeoutMs: 30000,
    isConcurrencySafe: () => false,
    async execute(args) {
      try {
        return toLosslessJson(await execute(args));
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : String(error));
      }
    }
  });
}
function writeTools(localRoot) {
  return [
    tool("netx__kbWriteMemory", `Create (or overwrite) one diary-style memory markdown under ${localRoot}/memories/. ` + "bucket: note→日常笔记, rca_review→排障复盘, ai_trace→AI思维链. " + "Default create-only; set overwrite=true to replace same filename. " + "Do not use workspace Write — KB is outside the sandbox.", {
      bucket: {
        type: "string",
        required: true,
        enum: ["note", "rca_review", "ai_trace"],
        description: "Memory subdirectory"
      },
      slug: reqStr("Short filename stem (no path separators)"),
      body: reqStr("Full markdown body"),
      date: str("Optional YYYY-MM-DD (default today)"),
      overwrite: bool("Replace if the target file already exists")
    }, (args) => createMemory(liveSnapshot(), {
      bucket: args.bucket,
      slug: String(args.slug ?? ""),
      body: String(args.body ?? ""),
      date: args.date != null ? String(args.date) : undefined,
      overwrite: args.overwrite === true
    })),
    tool("netx__kbWriteDraft", `Create (or overwrite) a DRAFT case under ${localRoot}/drafts/. ` + "Filename is forced to DRAFT-YYYYMMDD-…; body gets status: draft frontmatter if missing. " + "Set overwrite=true to replace. Not for formal RCA.", {
      slug: reqStr("Case stem (DRAFT- prefix added if missing)"),
      body: reqStr("Markdown body (RCA-ish draft)"),
      domain: str("Optional fault-domain subfolder under drafts/"),
      date: str("Optional event date YYYY-MM-DD or YYYYMMDD"),
      overwrite: bool("Replace if the target file already exists")
    }, (args) => createDraft(liveSnapshot(), {
      slug: String(args.slug ?? ""),
      body: String(args.body ?? ""),
      domain: args.domain != null ? String(args.domain) : undefined,
      date: args.date != null ? String(args.date) : undefined,
      overwrite: args.overwrite === true
    })),
    tool("netx__kbWriteSuggestion", `Create (or overwrite) a suggestion under ${localRoot}/suggestions/{theory|improvement}/. ` + "Use for HQ pack/theory corrections or tool/process improvements.", {
      kind: {
        type: "string",
        required: true,
        enum: ["theory", "improvement"],
        description: "theory = knowledge fix; improvement = tools/skills/process"
      },
      slug: reqStr("Short filename stem"),
      body: reqStr("Full markdown body"),
      date: str("Optional YYYY-MM-DD (default today)"),
      overwrite: bool("Replace if the target file already exists")
    }, (args) => createSuggestion(liveSnapshot(), {
      kind: args.kind,
      slug: String(args.slug ?? ""),
      body: String(args.body ?? ""),
      date: args.date != null ? String(args.date) : undefined,
      overwrite: args.overwrite === true
    })),
    tool("netx__kbWriteRef", `Create (or overwrite) site product-knowledge under ${localRoot}/refs/. ` + "area=inventory|devices|topology|business|commands|handbooks. " + "For devices: require device=host_name; default slug PROFILE for the ops profile. " + "Use for NE ledger, per-device profiles, topology/business notes, site command books — not diaries.", {
      area: {
        type: "string",
        required: true,
        enum: ["inventory", "devices", "topology", "business", "commands", "handbooks"],
        description: "refs/ subtree"
      },
      slug: reqStr("Filename stem (e.g. PROFILE, neighbors, ledger)"),
      body: reqStr("Full markdown body"),
      device: str("Required when area=devices — host_name (never UUID)"),
      overwrite: bool("Replace if the target file already exists")
    }, (args) => createRef(liveSnapshot(), {
      area: args.area,
      slug: String(args.slug ?? ""),
      body: String(args.body ?? ""),
      device: args.device != null ? String(args.device) : undefined,
      overwrite: args.overwrite === true
    })),
    tool("netx__kbUpdateLocal", `Replace the body of an existing file under memories|drafts|suggestions|refs ` + `(absolute path or path relative to ${localRoot}). ` + "Drafts keep status: draft.", {
      path: reqStr("Absolute path or path relative to KB local root"),
      body: reqStr("New full markdown body")
    }, (args) => updateLocalFile(liveSnapshot(), {
      path: String(args.path ?? ""),
      body: String(args.body ?? "")
    })),
    tool("netx__kbDeleteLocal", `Delete one existing markdown under memories|drafts|suggestions|refs ` + `(absolute or relative to ${localRoot}).`, {
      path: reqStr("Absolute path or path relative to KB local root")
    }, (args) => deleteLocalFile(liveSnapshot(), {
      path: String(args.path ?? "")
    })),
    tool("netx__kbListLocal", `List recent .md files under ${localRoot} memories|drafts|suggestions|refs (newest first). ` + "Read contents with netx__kbRead using the listed paths.", {
      root: {
        type: "string",
        enum: ["memories", "drafts", "suggestions", "refs", "all"],
        description: "Subtree to list (default all writable)"
      },
      limit: num("Max entries 1–200 (default 50)")
    }, (args) => listLocalFiles(liveSnapshot(), {
      root: args.root ?? "all",
      limit: typeof args.limit === "number" ? args.limit : undefined
    }))
  ];
}
function readTools(snapshot) {
  return [
    tool("netx__kbSearch", `Search the operator knowledge base at ${snapshot.realRoot} (read-only HQ pack + _local). ` + "Plain mode: space-separated keywords (NE host_name, alarm, protocol, symptom…), case-insensitive; " + "files ranked by how many distinct terms match (filename hits weigh more), up to 4 hit lines each. " + "Then open the best hits with netx__kbRead.", {
      query: reqStr("Keywords (space-separated) or a regex when regex=true"),
      scope: str("MANIFEST paths key(s) — e.g. rca, theory, theoryVendor, packet, commonPatterns, local, neIndex — or a relative dir; comma-separate several; default all"),
      regex: bool("Treat query as one case-insensitive JS regex"),
      limit: num("Max files 1–100 (default 20)")
    }, (args) => searchKb(liveSnapshot(), {
      query: String(args.query ?? ""),
      scope: args.scope != null ? String(args.scope) : undefined,
      regex: args.regex === true,
      limit: typeof args.limit === "number" ? args.limit : undefined
    })),
    tool("netx__kbRead", `Read one file (or list one directory) inside the knowledge base at ${snapshot.realRoot}. ` + "path: relative to kbRoot, absolute inside it, or a MANIFEST paths key (rca, neIndex, cmdLib, patternMap, …). " + "Long files: page with offset/limit (1-based lines; default 400).", {
      path: reqStr("KB-relative path, absolute path inside kbRoot, or a paths.* key"),
      offset: num("First line (1-based, default 1)"),
      limit: num("Max lines 1–2000 (default 400)")
    }, (args) => readKbFile(liveSnapshot(), {
      path: String(args.path ?? ""),
      offset: typeof args.offset === "number" ? args.offset : undefined,
      limit: typeof args.limit === "number" ? args.limit : undefined
    }))
  ];
}
function registerKbLocalTools(ctx, snapshot = getKbContext(), options = {}) {
  if (snapshot.status !== "configured")
    return () => {};
  const localRoot = resolveKbLocalRoot(snapshot);
  const toolsApi = ctx.tools;
  if (!toolsApi || typeof toolsApi.register !== "function")
    return () => {};
  const entries = [...readTools(snapshot), ...localRoot ? writeTools(localRoot) : []];
  const disposers = [];
  const source = options.source ?? "netxops-kb-local";
  const id = getToolMountId(ctx, source);
  const status = {
    id,
    source,
    version: getToolMountStatus()?.version ?? "",
    plane: options.plane ?? "preset",
    groups: ["kb"],
    at: new Date().toISOString()
  };
  try {
    for (const entry of entries)
      disposers.push(toolsApi.register(entry));
    publishToolMountStatus({ ...status, names: entries.map((entry) => entry.name), count: entries.length });
  } catch (error) {
    for (const dispose of disposers.reverse())
      dispose();
    publishToolMountStatus({ ...status, names: [], count: 0, error: String(error) });
    throw error;
  }
  ctx.logger.info("netxops: kb tools registered count=%s kbRoot=%s localRoot=%s", disposers.length, snapshot.realRoot, localRoot ?? "(none — read-only)");
  return () => {
    for (const dispose of disposers)
      dispose();
    removeToolMountStatus(id);
  };
}

// src/netx/kb-pack-skills.ts
import { readdir as readdir2, stat as stat2 } from "node:fs/promises";
import { join as join8 } from "node:path";
function kbPackSkillsEnabled(snapshot) {
  return snapshot.status === "configured" && snapshot.content.hasSkills === true;
}
function resolveKbSkillsRoot(snapshot) {
  const rel = snapshot.paths.skills?.trim() || "_skills";
  return join8(snapshot.realRoot, rel);
}
function kbPackSkillFooter(snapshot) {
  return [
    "",
    "",
    `## Injected KB anchors (netxops · ${snapshot.operatorName} / ${snapshot.country} v${snapshot.version})`,
    "",
    `kbStatus=configured · kbRoot=\`${snapshot.realRoot}\``,
    "",
    renderKbPathTable(snapshot),
    "",
    "These are already resolved from `MANIFEST.json` `paths.*`; use them verbatim.",
    "Read/search the pack with `netx__kbRead` / `netx__kbSearch` when present; write only via `netx__kbWrite*`.",
    ""
  ].join(`
`);
}
function resolveKbLocalSkillsRoot(snapshot) {
  const rel = snapshot.paths.localSkills?.trim();
  if (!rel)
    return null;
  return join8(snapshot.realRoot, rel);
}
async function registerSkillsUnderRoot(ctx, skillsApi, root, provider, options) {
  let entries;
  try {
    entries = await readdir2(root);
  } catch {
    if (options.logMissing) {
      ctx.logger.info("netxops: kb %s dir missing at %s — skip", options.label, root);
    }
    return [];
  }
  if (entries.length === 0)
    return [];
  const disposers = [];
  try {
    for (const entry of entries) {
      if (options.signal?.aborted)
        break;
      const full = join8(root, entry);
      let isDir = false;
      try {
        isDir = (await stat2(full)).isDirectory();
      } catch {
        continue;
      }
      if (!isDir)
        continue;
      let skill;
      try {
        skill = await loadSkillBundle(full);
      } catch (error) {
        ctx.logger.warn("netxops: kb %s skill load failed at %s: %s", options.label, full, error instanceof Error ? error.message : String(error));
        continue;
      }
      if (!skill) {
        ctx.logger.warn("netxops: kb %s skill skipped (invalid SKILL.md): %s", options.label, full);
        continue;
      }
      if (options.signal?.aborted)
        break;
      if (options.seen.has(skill.name)) {
        ctx.logger.warn("netxops: kb %s skill %s duplicates an already registered pack skill — skip %s", options.label, skill.name, full);
        continue;
      }
      try {
        disposers.push(skillsApi.register({
          name: skill.name,
          description: skill.description,
          content: `${skill.content.trimEnd()}${options.footer}`,
          path: skill.path,
          resourceBase: { kind: "directory", path: skill.directory },
          provider,
          source: "custom"
        }));
        options.seen.add(skill.name);
      } catch (error) {
        ctx.logger.warn("netxops: kb %s skill %s register failed: %s", options.label, skill.name, error instanceof Error ? error.message : String(error));
      }
    }
  } catch (error) {
    for (const dispose of disposers.splice(0))
      dispose();
    throw error;
  }
  return disposers;
}
async function registerKbPackSkills(ctx, snapshot, options) {
  if (!options.enabled || !kbPackSkillsEnabled(snapshot)) {
    return () => {};
  }
  const skillsApi = ctx.skills;
  if (!skillsApi || typeof skillsApi.register !== "function") {
    return () => {};
  }
  const provider = options.providerLabel ?? "netxops-kb-pack";
  const disposers = [];
  const skillsRoot = resolveKbSkillsRoot(snapshot);
  const localRoot = resolveKbLocalSkillsRoot(snapshot);
  const footer = kbPackSkillFooter(snapshot);
  const seen = new Set;
  try {
    disposers.push(...await registerSkillsUnderRoot(ctx, skillsApi, skillsRoot, provider, {
      logMissing: true,
      label: "pack",
      signal: options.signal,
      footer,
      seen
    }));
    if (localRoot) {
      disposers.push(...await registerSkillsUnderRoot(ctx, skillsApi, localRoot, provider, {
        logMissing: false,
        label: "local",
        signal: options.signal,
        footer,
        seen
      }));
    }
  } catch (error) {
    for (const dispose of disposers.splice(0))
      dispose();
    throw error;
  }
  if (options.signal?.aborted) {
    for (const dispose of disposers.splice(0))
      dispose();
  }
  if (disposers.length > 0) {
    ctx.logger.info("netxops: kb pack skills registered count=%s skillsRoot=%s localSkills=%s provider=%s", disposers.length, skillsRoot, localRoot ?? "(none)", provider);
  }
  return () => {
    for (const dispose of disposers)
      dispose();
  };
}

// src/netx/http.ts
function normalizeApiUrl(raw) {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed)
    return { ok: false, error: "empty" };
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "invalid_url" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "unsupported_scheme" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "credentials_in_url" };
  }
  const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
  const search = parsed.search && parsed.search !== "?" ? parsed.search : "";
  return { ok: true, url: `${parsed.origin}${path}${search}` };
}

// src/netx/runtime.ts
var STORE_KEY3 = Symbol.for("dsh-netxops.connection-store");
function store4() {
  const root = globalThis;
  let current = root[STORE_KEY3];
  if (current === undefined) {
    current = { connection: undefined, listeners: new Set };
    root[STORE_KEY3] = current;
  }
  return current;
}
function getNetxConnection() {
  return store4().connection;
}
function provisionalNetxConnection() {
  const envUrl = process.env.NETX_API_URL?.trim() ?? "";
  const normalized = envUrl ? normalizeApiUrl(envUrl) : normalizeApiUrl("http://127.0.0.1:8890");
  return {
    toolsEnabled: false,
    apiUrl: normalized.ok ? normalized.url : "http://127.0.0.1:8890",
    token: process.env.NETX_API_TOKEN?.trim() ?? "",
    lang: typeof process.env.NETX_LANG === "string" && process.env.NETX_LANG.trim() ? process.env.NETX_LANG.trim() : "zh",
    toolCallTimeoutMs: 120000,
    groups: DEFAULT_CAPABILITY_GROUPS,
    disabledTools: [],
    readOnlyOnly: false,
    groupKbInPreset: true,
    groupKbPublic: false
  };
}
function requireNetxConnection() {
  return getNetxConnection() ?? provisionalNetxConnection();
}
function watchNetxConnection(listener) {
  const state = store4();
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

// src/netx/tools.ts
import { readFileSync as readFileSync5 } from "node:fs";
import { dirname as dirname5, join as join9 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
import { defineTool as defineTool2 } from "@deepseek-ai/dsh-tools";

// src/netx/mcp-schema.ts
var ANNOTATIONS = ["description", "title", "default", "examples"];
var SCALAR_TYPES = new Set(["string", "number", "integer", "boolean", "null"]);
var CONSTRAINTS = [
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "minItems",
  "maxItems",
  "uniqueItems"
];
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function withAnnotations(source, target) {
  for (const key of ANNOTATIONS) {
    if (Object.hasOwn(source, key))
      target[key] = source[key];
  }
  const notes = CONSTRAINTS.filter((key) => Object.hasOwn(source, key)).map((key) => `${key}=${JSON.stringify(source[key])}`);
  if (notes.length > 0) {
    const base = typeof target.description === "string" ? target.description : "";
    target.description = `${base}${base ? " " : ""}(${notes.join(", ")})`;
  }
  return target;
}
function variants(node) {
  const list = Array.isArray(node.oneOf) ? node.oneOf : Array.isArray(node.anyOf) ? node.anyOf : undefined;
  if (list)
    return list.filter(isRecord).filter((branch) => branch.type !== "null");
  if (Array.isArray(node.type)) {
    const { type: _types, ...rest } = node;
    return node.type.filter((t) => t !== "null").map((t) => ({ ...rest, type: t }));
  }
  return;
}
function toValue(node) {
  if (!isRecord(node))
    return { type: "json" };
  const branches = variants(node);
  if (branches) {
    if (branches.length === 0)
      return withAnnotations(node, { type: "json" });
    if (branches.length === 1)
      return withAnnotations(node, toValue({ ...branches[0] }));
    return withAnnotations(node, { oneOf: branches.map(toValue) });
  }
  const type = node.type;
  if (type === "object" || type === undefined && isRecord(node.properties)) {
    const out = {
      type: "object",
      additionalProperties: typeof node.additionalProperties === "boolean" ? node.additionalProperties : true
    };
    if (isRecord(node.properties))
      out.properties = toProperties(node.properties, node.required);
    return withAnnotations(node, out);
  }
  if (type === "array") {
    const out = { type: "array" };
    if (Object.hasOwn(node, "items"))
      out.items = toValue(node.items);
    return withAnnotations(node, out);
  }
  if (typeof type === "string" && SCALAR_TYPES.has(type)) {
    const out = { type };
    if (Array.isArray(node.enum) && node.enum.length > 0)
      out.enum = node.enum;
    if (Object.hasOwn(node, "const"))
      out.const = node.const;
    return withAnnotations(node, out);
  }
  return withAnnotations(node, { type: "json" });
}
function toProperties(properties, required) {
  const requiredSet = new Set(Array.isArray(required) ? required.filter((k) => typeof k === "string") : []);
  const out = {};
  for (const [key, value] of Object.entries(properties)) {
    const converted = toValue(value);
    if (requiredSet.has(key))
      converted.required = true;
    out[key] = converted;
  }
  return out;
}
function parametersFromInputSchema(schema) {
  if (!isRecord(schema) || !isRecord(schema.properties))
    return {};
  return toProperties(schema.properties, schema.required);
}

// src/netx/tools.ts
function packageVersion() {
  try {
    const here = dirname5(fileURLToPath2(import.meta.url));
    const pkg = JSON.parse(readFileSync5(join9(here, "..", "package.json"), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "0";
  } catch {
    return "0";
  }
}
function renderMcpResult(_args, value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const row = value;
    if (typeof row.text === "string" && row.text.length > 0) {
      return [{ type: "text", text: row.text }];
    }
    if (Array.isArray(row.content)) {
      return [{ type: "text", text: mcpContentText(row.content, JSON.stringify(value)) }];
    }
  }
  return [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value ?? null) }];
}
var mcpOut = {
  schema: { type: "object", additionalProperties: true },
  render: renderMcpResult
};
function defineRemoteTool(tool2, timeoutMs) {
  const name = publicToolName(tool2.name);
  return defineTool2({
    name,
    description: tool2.description || name,
    parameters: parametersFromInputSchema(tool2.inputSchema),
    output: mcpOut,
    timeoutMs,
    isConcurrencySafe: () => tool2.readOnlyHint === true,
    async execute(args, exec) {
      const live = getNetxConnection();
      const apiUrl = live?.apiUrl ?? "";
      const token = live?.token ?? "";
      const lang = live?.lang ?? "zh";
      const mcpUrl = mcpEndpointUrl(apiUrl);
      if (!mcpUrl)
        throw new Error("netx mcp: apiUrl empty");
      const result = await callMcpTool({
        mcpUrl,
        token,
        lang,
        timeoutMs,
        signal: exec.signal
      }, tool2.name, typeof args === "object" && args !== null ? args : {});
      const text = mcpContentText(result.content, "");
      if (result.isError === true) {
        throw new Error(text || `Tool "${tool2.name}" failed`);
      }
      return JSON.parse(JSON.stringify({
        content: result.content,
        ...result.structuredContent !== undefined ? { structuredContent: result.structuredContent } : {},
        ...text ? { text } : {}
      }));
    }
  });
}
function registerNetxTools(ctx, connection, options) {
  const id = getToolMountId(ctx, options.source ?? options.plane);
  const enabled = resolveEnabledTools(getMcpCatalogTools(), {
    toolsEnabled: connection.toolsEnabled,
    groups: connection.groups,
    disabledTools: connection.disabledTools,
    readOnlyOnly: connection.readOnlyOnly,
    plane: options.plane,
    forceGroups: options.forceGroups,
    only: options.only,
    presetId: options.presetId
  });
  const groups = [...new Set(enabled.map((tool2) => tool2.group).filter(Boolean))];
  if (enabled.length === 0) {
    publishToolMountStatus({
      id,
      version: packageVersion(),
      plane: options.plane,
      groups,
      names: [],
      count: 0,
      at: new Date().toISOString(),
      source: options.source ?? options.plane
    });
    return () => {
      removeToolMountStatus(id);
    };
  }
  const t = typeof connection.toolCallTimeoutMs === "number" && Number.isFinite(connection.toolCallTimeoutMs) && connection.toolCallTimeoutMs > 0 ? connection.toolCallTimeoutMs : 120000;
  const disposers = [];
  const names = [];
  try {
    for (const tool2 of enabled) {
      const definition = defineRemoteTool(tool2, t);
      disposers.push(ctx.tools.register(definition));
      names.push(publicToolName(tool2.name));
    }
  } catch (error) {
    for (const dispose of disposers.splice(0))
      dispose();
    publishToolMountStatus({
      id,
      version: packageVersion(),
      plane: options.plane,
      groups,
      names: [],
      count: 0,
      at: new Date().toISOString(),
      error: String(error),
      source: options.source ?? options.plane
    });
    throw error;
  }
  publishToolMountStatus({
    id,
    version: packageVersion(),
    plane: options.plane,
    groups,
    names,
    count: names.length,
    at: new Date().toISOString(),
    source: options.source ?? options.plane
  });
  return () => {
    for (const dispose of disposers)
      dispose();
    removeToolMountStatus(id);
  };
}

// src/netx/group-tools-plugin.ts
function packageVersion2() {
  try {
    const here = dirname6(fileURLToPath3(import.meta.url));
    const pkg = JSON.parse(readFileSync6(join10(here, "..", "package.json"), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "0";
  } catch {
    return "0";
  }
}
function disabledByGroupFor(groupIds, connection) {
  const catalog = getMcpCatalogTools();
  const out = {};
  for (const groupId of groupIds) {
    const names = disabledPublicNames(catalog, [groupId], connection.disabledTools, connection.readOnlyOnly);
    if (names.length > 0)
      out[groupId] = names;
  }
  return out;
}
function applyGroupToolsPlugin(ctx, options) {
  let unregisterTools;
  let unregisterKbLocal;
  let unregisterSkills;
  let skillGeneration = 0;
  const presetId = () => {
    if (options.presetId)
      return options.presetId;
    const registry = ctx.get("agentPresets");
    return registry?.composedPreset?.(ctx) ?? "netxops";
  };
  const mountId = getToolMountId(ctx, options.name);
  const resolveGroups = () => {
    const connection = requireNetxConnection();
    return groupsForPreset(connection, presetId(), options.only);
  };
  const remountTools = () => {
    unregisterTools?.();
    unregisterTools = undefined;
    const connection = requireNetxConnection();
    const enabled = resolveGroups();
    try {
      unregisterTools = registerNetxTools(ctx, connection, {
        plane: "preset",
        forceGroups: enabled,
        source: options.name,
        presetId: presetId()
      });
      ctx.logger.info("%s: groups=[%s] → %s tokenConfigured=%s live=%s catalog=%s", options.name, enabled.join(",") || "(none)", connection.apiUrl, connection.token.trim().length > 0, getNetxConnection() !== undefined, getMcpCatalogTools().length);
    } catch (error) {
      publishToolMountStatus({
        id: mountId,
        version: packageVersion2(),
        plane: "preset",
        groups: [...enabled],
        names: [],
        count: 0,
        at: new Date().toISOString(),
        error: String(error),
        source: options.name
      });
      ctx.logger.error("%s: registerNetxTools failed: %s", options.name, error);
    }
  };
  const remountKbLocal = () => {
    unregisterKbLocal?.();
    unregisterKbLocal = undefined;
    const connection = requireNetxConnection();
    if (options.only || !kbEnabledForPlane(connection, "preset", presetId()))
      return;
    unregisterKbLocal = registerKbLocalTools(ctx, getKbContext(), { plane: "preset", source: `${options.name}:kb-local` });
  };
  const stopToolWatch = watchNetxConnection(() => {
    remountTools();
    remountKbLocal();
  });
  const stopCatalogWatch = watchMcpCatalog(() => {
    remountTools();
  });
  const stopKbToolWatch = watchKbContext(() => {
    remountKbLocal();
  });
  remountTools();
  remountKbLocal();
  let pollTicks = 0;
  const pollTimer = setInterval(() => {
    pollTicks += 1;
    if (getNetxConnection() !== undefined) {
      remountTools();
      remountKbLocal();
      clearInterval(pollTimer);
      return;
    }
    if (pollTicks >= 40)
      clearInterval(pollTimer);
  }, 500);
  ctx.inject(["skills"], (skillsCtx) => {
    let skillAbort = new AbortController;
    let packAbort = new AbortController;
    let unregisterKbSkill;
    let unregisterKbPack;
    let packGeneration = 0;
    const remountSkills = () => {
      const gen = ++skillGeneration;
      skillAbort.abort();
      skillAbort = new AbortController;
      unregisterSkills?.();
      unregisterSkills = undefined;
      const connection = requireNetxConnection();
      const enabled = resolveGroups();
      registerGroupSkills(skillsCtx, enabled, options.name, {
        signal: skillAbort.signal,
        disabledByGroup: disabledByGroupFor(enabled, connection),
        lang: connection.lang
      }).then((dispose) => {
        if (gen !== skillGeneration) {
          dispose();
          return;
        }
        unregisterSkills = dispose;
      }).catch((error) => {
        skillsCtx.logger.warn("%s: skill register failed: %s", options.name, error);
      });
    };
    const remountKbSkill = () => {
      unregisterKbSkill?.();
      unregisterKbSkill = undefined;
      const connection = requireNetxConnection();
      if (options.only || !kbEnabledForPlane(connection, "preset", presetId()))
        return;
      unregisterKbSkill = registerKbContextSkill(skillsCtx, getKbContext());
    };
    const remountKbPack = () => {
      const gen = ++packGeneration;
      packAbort.abort();
      packAbort = new AbortController;
      unregisterKbPack?.();
      unregisterKbPack = undefined;
      const connection = requireNetxConnection();
      const enabled = !options.only && kbEnabledForPlane(connection, "preset", presetId());
      registerKbPackSkills(skillsCtx, getKbContext(), {
        enabled,
        providerLabel: `${options.name}-kb-pack`,
        signal: packAbort.signal
      }).then((dispose) => {
        if (gen !== packGeneration) {
          dispose();
          return;
        }
        unregisterKbPack = dispose;
      }).catch((error) => {
        skillsCtx.logger.warn("%s: kb pack skill register failed: %s", options.name, error);
      });
    };
    const stopSkillWatch = watchNetxConnection(() => {
      remountSkills();
      remountKbSkill();
      remountKbPack();
    });
    const stopSkillCatalogWatch = watchMcpCatalog(() => {
      remountSkills();
    });
    const stopKbWatch = watchKbContext(() => {
      remountKbSkill();
      remountKbPack();
    });
    remountSkills();
    remountKbSkill();
    remountKbPack();
    skillsCtx.effect(() => () => {
      skillGeneration += 1;
      packGeneration += 1;
      skillAbort.abort();
      packAbort.abort();
      stopSkillWatch();
      stopSkillCatalogWatch();
      stopKbWatch();
      unregisterSkills?.();
      unregisterSkills = undefined;
      unregisterKbSkill?.();
      unregisterKbSkill = undefined;
      unregisterKbPack?.();
      unregisterKbPack = undefined;
    }, `${options.name}: dispose skills`);
  });
  ctx.effect(() => () => {
    clearInterval(pollTimer);
    stopToolWatch();
    stopCatalogWatch();
    stopKbToolWatch();
    unregisterTools?.();
    unregisterTools = undefined;
    unregisterKbLocal?.();
    unregisterKbLocal = undefined;
    removeToolMountStatus(mountId);
  }, `${options.name}: dispose tools`);
}

// src/agent-tools-topology.ts
var name = "netxops-tools-topology";
var inject = ["tools"];
function apply(ctx) {
  applyGroupToolsPlugin(ctx, { name, mode: "forced", only: ["topology"] });
}
export {
  name,
  inject,
  apply
};
