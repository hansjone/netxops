window.__ModuleLoader__.load({
  id: "dsh-netxops",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toCommonJS = (from) => {
  var entry = (__moduleCache ??= new WeakMap).get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function") {
    for (var key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(entry, key))
        __defProp(entry, key, {
          get: __accessProp.bind(from, key),
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
        });
  }
  __moduleCache.set(from, entry);
  return entry;
};
var __moduleCache;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// src/client/index.ts
var exports_client = {};
__export(exports_client, {
  inject: () => inject,
  apply: () => apply
});
module.exports = __toCommonJS(exports_client);

// src/client/NetxopsCard.tsx
var import_react = require("react");

// src/client/alarm-push-status-view.ts
var NETXOPS_RPC_CHANNEL = "/netxops";
var ALARM_PUSH_STATUS_ENDPOINT = "alarm-push.status";
var EMPTY = {
  phase: "disabled",
  enabled: false,
  wsUrl: "",
  detail: "",
  updatedAt: 0,
  lastConnectedAt: null,
  lastError: null
};
function asAlarmPushStatus(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return { ...EMPTY };
  const row = value;
  const phase = typeof row.phase === "string" ? row.phase : "disabled";
  return {
    phase,
    enabled: row.enabled === true,
    wsUrl: typeof row.wsUrl === "string" ? row.wsUrl : "",
    detail: typeof row.detail === "string" ? row.detail : "",
    updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : 0,
    lastConnectedAt: typeof row.lastConnectedAt === "number" ? row.lastConnectedAt : null,
    lastError: typeof row.lastError === "string" ? row.lastError : null
  };
}
async function fetchAlarmPushStatus(call, signal) {
  const result = await call(NETXOPS_RPC_CHANNEL, ALARM_PUSH_STATUS_ENDPOINT, {}, signal);
  if (result !== null && typeof result === "object" && result.ok === true) {
    return asAlarmPushStatus(result.value);
  }
  if (result !== null && typeof result === "object" && result.ok === false) {
    return {
      ...EMPTY,
      phase: "error",
      enabled: true,
      detail: "rpc_error",
      lastError: String(result.error?.message ?? "rpc failed")
    };
  }
  return asAlarmPushStatus(result);
}
function alarmPushTone(phase) {
  switch (phase) {
    case "connected":
      return "ok";
    case "connecting":
    case "authenticating":
    case "reconnecting":
      return "warn";
    case "auth_failed":
    case "error":
      return "err";
    default:
      return "mute";
  }
}

// src/client/im-delivery-catalog.ts
var IM_DELIVERY_CATALOG_ENDPOINT = "im-delivery.catalog";
var EMPTY_IM_DELIVERY_CATALOG = {
  available: true,
  options: [],
  hint: "",
  loading: false
};
function asImDeliveryCatalog(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_IM_DELIVERY_CATALOG, available: false };
  }
  const row = value;
  const raw = Array.isArray(row.options) ? row.options : [];
  const options = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry))
      continue;
    const item = entry;
    const botId = typeof item.botId === "string" ? item.botId.trim() : "";
    const targetId = typeof item.targetId === "string" ? item.targetId.trim() : "";
    if (!botId || !targetId)
      continue;
    options.push({
      botId,
      targetId,
      name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : targetId,
      kind: typeof item.kind === "string" ? item.kind : "",
      channel: typeof item.channel === "string" ? item.channel : "im"
    });
  }
  return {
    available: row.available !== false,
    options,
    hint: typeof row.hint === "string" ? row.hint : "",
    reasonCode: row.reasonCode === "im_catalog_unavailable" || row.reasonCode === "rpc_failed" ? row.reasonCode : undefined,
    loading: false
  };
}
async function fetchImDeliveryCatalog(call, signal) {
  const result = await call(NETXOPS_RPC_CHANNEL, IM_DELIVERY_CATALOG_ENDPOINT, {}, signal);
  if (result !== null && typeof result === "object" && result.ok === true) {
    return asImDeliveryCatalog(result.value);
  }
  if (result !== null && typeof result === "object" && result.ok === false) {
    return {
      ...EMPTY_IM_DELIVERY_CATALOG,
      available: false,
      reasonCode: "rpc_failed",
      hint: String(result.error?.message ?? "rpc failed")
    };
  }
  return asImDeliveryCatalog(result);
}
function imCatalogOptionKey(botId, targetId) {
  return `${botId}::${targetId}`;
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
function formatImTargetsJson(targets) {
  const seen = new Set;
  const rows = [];
  for (const entry of targets) {
    const target = normalizeImTarget(entry);
    if (!target)
      continue;
    const key = imTargetKey(target.botId, target.targetId);
    if (seen.has(key))
      continue;
    seen.add(key);
    rows.push(target);
  }
  return rows.length === 0 ? "" : JSON.stringify(rows);
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
function setImTargetSelected(current, target, selected) {
  const key = imTargetKey(target.botId, target.targetId);
  const without = current.filter((row) => imTargetKey(row.botId, row.targetId) !== key);
  if (!selected)
    return without;
  const normalized = normalizeImTarget(target);
  return normalized ? [...without, normalized] : without;
}

// src/netx/kb-manifest.ts
var import_node_fs = (() => ({}));

// node:path
function assertPath(path) {
  if (typeof path !== "string")
    throw TypeError("Path must be a string. Received " + JSON.stringify(path));
}
function normalizeStringPosix(path, allowAboveRoot) {
  var res = "", lastSegmentLength = 0, lastSlash = -1, dots = 0, code;
  for (var i = 0;i <= path.length; ++i) {
    if (i < path.length)
      code = path.charCodeAt(i);
    else if (code === 47)
      break;
    else
      code = 47;
    if (code === 47) {
      if (lastSlash === i - 1 || dots === 1)
        ;
      else if (lastSlash !== i - 1 && dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 || res.charCodeAt(res.length - 2) !== 46) {
          if (res.length > 2) {
            var lastSlashIndex = res.lastIndexOf("/");
            if (lastSlashIndex !== res.length - 1) {
              if (lastSlashIndex === -1)
                res = "", lastSegmentLength = 0;
              else
                res = res.slice(0, lastSlashIndex), lastSegmentLength = res.length - 1 - res.lastIndexOf("/");
              lastSlash = i, dots = 0;
              continue;
            }
          } else if (res.length === 2 || res.length === 1) {
            res = "", lastSegmentLength = 0, lastSlash = i, dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0)
            res += "/..";
          else
            res = "..";
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0)
          res += "/" + path.slice(lastSlash + 1, i);
        else
          res = path.slice(lastSlash + 1, i);
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i, dots = 0;
    } else if (code === 46 && dots !== -1)
      ++dots;
    else
      dots = -1;
  }
  return res;
}
function _format(sep, pathObject) {
  var dir = pathObject.dir || pathObject.root, base = pathObject.base || (pathObject.name || "") + (pathObject.ext || "");
  if (!dir)
    return base;
  if (dir === pathObject.root)
    return dir + base;
  return dir + sep + base;
}
function resolve() {
  var resolvedPath = "", resolvedAbsolute = false, cwd;
  for (var i = arguments.length - 1;i >= -1 && !resolvedAbsolute; i--) {
    var path;
    if (i >= 0)
      path = arguments[i];
    else {
      if (cwd === undefined)
        cwd = process.cwd();
      path = cwd;
    }
    if (assertPath(path), path.length === 0)
      continue;
    resolvedPath = path + "/" + resolvedPath, resolvedAbsolute = path.charCodeAt(0) === 47;
  }
  if (resolvedPath = normalizeStringPosix(resolvedPath, !resolvedAbsolute), resolvedAbsolute)
    if (resolvedPath.length > 0)
      return "/" + resolvedPath;
    else
      return "/";
  else if (resolvedPath.length > 0)
    return resolvedPath;
  else
    return ".";
}
function normalize(path) {
  if (assertPath(path), path.length === 0)
    return ".";
  var isAbsolute = path.charCodeAt(0) === 47, trailingSeparator = path.charCodeAt(path.length - 1) === 47;
  if (path = normalizeStringPosix(path, !isAbsolute), path.length === 0 && !isAbsolute)
    path = ".";
  if (path.length > 0 && trailingSeparator)
    path += "/";
  if (isAbsolute)
    return "/" + path;
  return path;
}
function isAbsolute(path) {
  return assertPath(path), path.length > 0 && path.charCodeAt(0) === 47;
}
function join() {
  if (arguments.length === 0)
    return ".";
  var joined;
  for (var i = 0;i < arguments.length; ++i) {
    var arg = arguments[i];
    if (assertPath(arg), arg.length > 0)
      if (joined === undefined)
        joined = arg;
      else
        joined += "/" + arg;
  }
  if (joined === undefined)
    return ".";
  return normalize(joined);
}
function relative(from, to) {
  if (assertPath(from), assertPath(to), from === to)
    return "";
  if (from = resolve(from), to = resolve(to), from === to)
    return "";
  var fromStart = 1;
  for (;fromStart < from.length; ++fromStart)
    if (from.charCodeAt(fromStart) !== 47)
      break;
  var fromEnd = from.length, fromLen = fromEnd - fromStart, toStart = 1;
  for (;toStart < to.length; ++toStart)
    if (to.charCodeAt(toStart) !== 47)
      break;
  var toEnd = to.length, toLen = toEnd - toStart, length = fromLen < toLen ? fromLen : toLen, lastCommonSep = -1, i = 0;
  for (;i <= length; ++i) {
    if (i === length) {
      if (toLen > length) {
        if (to.charCodeAt(toStart + i) === 47)
          return to.slice(toStart + i + 1);
        else if (i === 0)
          return to.slice(toStart + i);
      } else if (fromLen > length) {
        if (from.charCodeAt(fromStart + i) === 47)
          lastCommonSep = i;
        else if (i === 0)
          lastCommonSep = 0;
      }
      break;
    }
    var fromCode = from.charCodeAt(fromStart + i), toCode = to.charCodeAt(toStart + i);
    if (fromCode !== toCode)
      break;
    else if (fromCode === 47)
      lastCommonSep = i;
  }
  var out = "";
  for (i = fromStart + lastCommonSep + 1;i <= fromEnd; ++i)
    if (i === fromEnd || from.charCodeAt(i) === 47)
      if (out.length === 0)
        out += "..";
      else
        out += "/..";
  if (out.length > 0)
    return out + to.slice(toStart + lastCommonSep);
  else {
    if (toStart += lastCommonSep, to.charCodeAt(toStart) === 47)
      ++toStart;
    return to.slice(toStart);
  }
}
function _makeLong(path) {
  return path;
}
function dirname(path) {
  if (assertPath(path), path.length === 0)
    return ".";
  var code = path.charCodeAt(0), hasRoot = code === 47, end = -1, matchedSlash = true;
  for (var i = path.length - 1;i >= 1; --i)
    if (code = path.charCodeAt(i), code === 47) {
      if (!matchedSlash) {
        end = i;
        break;
      }
    } else
      matchedSlash = false;
  if (end === -1)
    return hasRoot ? "/" : ".";
  if (hasRoot && end === 1)
    return "//";
  return path.slice(0, end);
}
function basename(path, ext) {
  if (ext !== undefined && typeof ext !== "string")
    throw TypeError('"ext" argument must be a string');
  assertPath(path);
  var start = 0, end = -1, matchedSlash = true, i;
  if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
    if (ext.length === path.length && ext === path)
      return "";
    var extIdx = ext.length - 1, firstNonSlashEnd = -1;
    for (i = path.length - 1;i >= 0; --i) {
      var code = path.charCodeAt(i);
      if (code === 47) {
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else {
        if (firstNonSlashEnd === -1)
          matchedSlash = false, firstNonSlashEnd = i + 1;
        if (extIdx >= 0)
          if (code === ext.charCodeAt(extIdx)) {
            if (--extIdx === -1)
              end = i;
          } else
            extIdx = -1, end = firstNonSlashEnd;
      }
    }
    if (start === end)
      end = firstNonSlashEnd;
    else if (end === -1)
      end = path.length;
    return path.slice(start, end);
  } else {
    for (i = path.length - 1;i >= 0; --i)
      if (path.charCodeAt(i) === 47) {
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1)
        matchedSlash = false, end = i + 1;
    if (end === -1)
      return "";
    return path.slice(start, end);
  }
}
function extname(path) {
  assertPath(path);
  var startDot = -1, startPart = 0, end = -1, matchedSlash = true, preDotState = 0;
  for (var i = path.length - 1;i >= 0; --i) {
    var code = path.charCodeAt(i);
    if (code === 47) {
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1)
      matchedSlash = false, end = i + 1;
    if (code === 46) {
      if (startDot === -1)
        startDot = i;
      else if (preDotState !== 1)
        preDotState = 1;
    } else if (startDot !== -1)
      preDotState = -1;
  }
  if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)
    return "";
  return path.slice(startDot, end);
}
function format(pathObject) {
  if (pathObject === null || typeof pathObject !== "object")
    throw TypeError('The "pathObject" argument must be of type Object. Received type ' + typeof pathObject);
  return _format("/", pathObject);
}
function parse(path) {
  assertPath(path);
  var ret = { root: "", dir: "", base: "", ext: "", name: "" };
  if (path.length === 0)
    return ret;
  var code = path.charCodeAt(0), isAbsolute2 = code === 47, start;
  if (isAbsolute2)
    ret.root = "/", start = 1;
  else
    start = 0;
  var startDot = -1, startPart = 0, end = -1, matchedSlash = true, i = path.length - 1, preDotState = 0;
  for (;i >= start; --i) {
    if (code = path.charCodeAt(i), code === 47) {
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1)
      matchedSlash = false, end = i + 1;
    if (code === 46) {
      if (startDot === -1)
        startDot = i;
      else if (preDotState !== 1)
        preDotState = 1;
    } else if (startDot !== -1)
      preDotState = -1;
  }
  if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    if (end !== -1)
      if (startPart === 0 && isAbsolute2)
        ret.base = ret.name = path.slice(1, end);
      else
        ret.base = ret.name = path.slice(startPart, end);
  } else {
    if (startPart === 0 && isAbsolute2)
      ret.name = path.slice(1, startDot), ret.base = path.slice(1, end);
    else
      ret.name = path.slice(startPart, startDot), ret.base = path.slice(startPart, end);
    ret.ext = path.slice(startDot, end);
  }
  if (startPart > 0)
    ret.dir = path.slice(0, startPart - 1);
  else if (isAbsolute2)
    ret.dir = "/";
  return ret;
}
var sep = "/";
var delimiter = ":";
var posix = ((p) => (p.posix = p, p))({ resolve, normalize, isAbsolute, join, relative, _makeLong, dirname, basename, extname, format, parse, sep, delimiter, win32: null, posix: null });

// src/netx/kb-manifest.ts
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

// src/client/kb-status-view.ts
var NETXOPS_RPC_CHANNEL2 = "/netxops";
var KB_STATUS_ENDPOINT = "kb.status";
var KB_RELOAD_ENDPOINT = "kb.reload";
var KB_RESOLVE_ENDPOINT = "kb.resolve";
function asKbSnapshot(value) {
  const empty = unconfiguredKbSnapshot();
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return empty;
  const row = value;
  const status = row.status === "configured" || row.status === "error" || row.status === "unconfigured" ? row.status : "unconfigured";
  const contentRaw = row.content;
  const content = { ...empty.content };
  if (contentRaw !== null && typeof contentRaw === "object" && !Array.isArray(contentRaw)) {
    for (const [key, flag] of Object.entries(contentRaw)) {
      content[key] = flag === true;
    }
  }
  const pathsRaw = row.paths;
  const paths = {};
  if (pathsRaw !== null && typeof pathsRaw === "object" && !Array.isArray(pathsRaw)) {
    for (const [key, value2] of Object.entries(pathsRaw)) {
      if (typeof value2 === "string" && value2.trim())
        paths[key] = value2.trim();
    }
  }
  return {
    status,
    realRoot: typeof row.realRoot === "string" ? row.realRoot : "",
    operatorName: typeof row.operatorName === "string" ? row.operatorName : "",
    country: typeof row.country === "string" ? row.country : "",
    version: typeof row.version === "string" ? row.version : "",
    content,
    paths,
    errorMessage: typeof row.errorMessage === "string" ? row.errorMessage : ""
  };
}
function asRpcOk(result) {
  return result !== null && typeof result === "object" && result.ok === true;
}
async function fetchKbStatus(call, signal) {
  const result = await call(NETXOPS_RPC_CHANNEL2, KB_STATUS_ENDPOINT, {}, signal);
  if (asRpcOk(result)) {
    return asKbSnapshot(result.value);
  }
  if (result !== null && typeof result === "object" && result.ok === false) {
    const message = String(result.error?.message ?? "kb.status rpc failed");
    return { ...unconfiguredKbSnapshot(), status: "error", errorMessage: message };
  }
  return {
    ...unconfiguredKbSnapshot(),
    status: "error",
    errorMessage: "kb.status unavailable"
  };
}
async function reloadKbStatus(call, signal) {
  const result = await call(NETXOPS_RPC_CHANNEL2, KB_RELOAD_ENDPOINT, {}, signal);
  if (asRpcOk(result)) {
    return asKbSnapshot(result.value);
  }
  return fetchKbStatus(call, signal);
}
async function resolveKbPath(call, path, signal) {
  let result = await call(NETXOPS_RPC_CHANNEL2, KB_RESOLVE_ENDPOINT, { path }, signal);
  if (!asRpcOk(result)) {
    result = await call(NETXOPS_RPC_CHANNEL2, KB_RESOLVE_ENDPOINT, { args: { path } }, signal);
  }
  if (asRpcOk(result)) {
    return asKbSnapshot(result.value);
  }
  return {
    ...unconfiguredKbSnapshot(),
    status: "error",
    errorMessage: "kb.resolve unavailable"
  };
}
function kbStatusTone(status) {
  if (status === "configured")
    return "ok";
  if (status === "error")
    return "err";
  if (status === "unconfigured")
    return "warn";
  return "neutral";
}

// src/client/styles.ts
var STYLE_ID = "dsh-netxops-settings-css";
var CSS = `
.dsh-nx-settings{box-sizing:border-box;display:flex;flex-direction:column;gap:20px;min-height:0;padding:4px 4px 24px;color:var(--dsw-alias-label-primary,#1f2329)}
.dsh-nx-settings>header{display:flex;flex-direction:column;gap:4px}
.dsh-nx-settings h2{margin:0;font-size:20px;font-weight:600;line-height:28px}
.dsh-nx-settings-intro{margin:0;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary,#646a73)}
.dsh-nx-settings-card{border:1px solid var(--dsw-alias-border-l2,#dee0e3);border-radius:12px;padding:16px;background:var(--dsw-alias-bg-layer-1,transparent)}
.dsh-nx-settings-card h3{margin:0 0 12px;font-size:15px;font-weight:600;line-height:22px}
.dsh-nx-settings-field{display:flex;flex-direction:column;gap:4px;margin-bottom:12px}
.dsh-nx-settings-field:last-child{margin-bottom:0}
.dsh-nx-settings-field>label,.dsh-nx-field-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#646a73)}
.dsh-nx-field-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.dsh-nx-field-head>label,.dsh-nx-field-head>.dsh-nx-field-label{flex:1;min-width:0}
.dsh-nx-settings-field input[type=text],
.dsh-nx-settings-field input[type=password],
.dsh-nx-settings-field input:not([type]),
.dsh-nx-settings-field select{
  box-sizing:border-box;width:100%;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2,#dfe1e5);border-radius:6px;font:inherit;font-size:13px;line-height:20px;background:var(--dsw-alias-bg-module-platform,#f4f5f7);color:inherit
}
.dsh-nx-settings-field input:focus-visible,
.dsh-nx-settings-field select:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#3370ff);outline-offset:1px}
.dsh-nx-settings-field input:disabled,
.dsh-nx-settings-field select:disabled{opacity:.55;cursor:default}
.dsh-nx-inputInvalid{border-color:var(--dsw-alias-state-error-primary,#d54941)!important}
.dsh-nx-hint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#8f959e)}
.dsh-nx-invalid{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary,#d54941)}
.dsh-nx-badges{display:inline-flex;align-items:center;gap:8px;flex:none}
.dsh-nx-badge{border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px;white-space:nowrap;font-weight:500;background:var(--dsw-alias-bg-module-platform,#f4f5f7);color:var(--dsw-alias-label-secondary,#646a73)}
.dsh-nx-badgeMuted{border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px;white-space:nowrap;color:var(--dsw-alias-label-tertiary,#8f959e)}
.dsh-nx-status{border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px;font-weight:500;white-space:nowrap;background:var(--dsw-alias-bg-module-platform,#f4f5f7);color:var(--dsw-alias-label-tertiary,#8f959e)}
.dsh-nx-statusOk{color:var(--dsw-alias-state-success-primary,#20a162);background:rgba(32,161,98,.12)}
.dsh-nx-statusWarn{color:var(--dsw-alias-state-warn-primary,#d97706);background:rgba(217,119,6,.12)}
.dsh-nx-statusErr{color:var(--dsw-alias-state-error-primary,#d54941);background:rgba(213,73,65,.12)}
.dsh-nx-reset{border:none;background:none;padding:0;font:inherit;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-business-primary,#3370ff);cursor:pointer}
.dsh-nx-reset:hover:not(:disabled){opacity:.85}
.dsh-nx-reset:disabled{opacity:.4;cursor:default}
.dsh-nx-checkRow{display:flex;align-items:flex-start;gap:10px;margin:0;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary,#1f2329);cursor:pointer}
.dsh-nx-checkRow input{margin-top:3px;flex:none}
.dsh-nx-groupBlock{display:flex;flex-direction:column;gap:8px;padding:4px 0 8px}
.dsh-nx-groupBlock+.dsh-nx-groupBlock{border-top:1px solid var(--dsw-alias-border-l1,#eef0f3);padding-top:12px}
.dsh-nx-groupTitle{font-size:13px;font-weight:600;line-height:1.5;color:var(--dsw-alias-label-primary,#1f2329)}
.dsh-nx-groupChecks{display:flex;flex-direction:column;gap:8px;padding-left:2px}
.dsh-nx-imTargetList{display:flex;flex-direction:column;gap:8px;padding:4px 0 2px}
.dsh-nx-pathRow{display:flex;gap:8px;align-items:stretch}
.dsh-nx-pathRow>input{flex:1;min-width:0}
.dsh-nx-pathRow>.dsh-nx-btn{flex:none;align-self:stretch}
.dsh-nx-settings-msg{font-size:12px;color:var(--dsw-alias-label-secondary,#646a73)}
.dsh-nx-settings-msg.ok{color:var(--dsw-alias-state-success-primary,#20a162)}
.dsh-nx-settings-msg.err{color:var(--dsw-alias-state-error-primary,#d54941)}
.dsh-nx-settings-empty{padding:24px;text-align:center;color:var(--dsw-alias-label-tertiary,#8f959e);font-size:13px}
.dsh-nx-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--dsw-alias-border-l2,#dfe1e5);border-radius:4px;padding:8px 12px;font:inherit;font-size:13px;line-height:20px;cursor:pointer;background:var(--dsw-alias-bg-module-platform,#f4f5f7);color:var(--dsw-alias-label-primary,#1f2329)}
.dsh-nx-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,#f7f8fa)}
.dsh-nx-btn:disabled{opacity:.4;cursor:default}
.dsh-nx-btn-primary{background:var(--dsw-alias-state-business-primary,#3370ff);color:#fff;border-color:transparent}
.dsh-nx-btn-primary:hover:not(:disabled){opacity:.9;background:var(--dsw-alias-state-business-primary,#3370ff)}
.dsh-nx-btn-ghost{background:transparent}
`;
function ensureStyles() {
  if (typeof document === "undefined")
    return;
  if (document.getElementById(STYLE_ID))
    return;
  const tag = document.createElement("style");
  tag.id = STYLE_ID;
  tag.textContent = CSS;
  document.head.appendChild(tag);
}

// src/session-export-shared.ts
var NETXOPS_SESSIONS_EXPORT_PATH = "/api/netxops.sessions.export";

// src/client/sessions-export-view.ts
var SESSIONS_EXPORT_STATUS_ENDPOINT = "sessions.export.status";
var EMPTY_STATUS = {
  available: false,
  sessionCount: 0,
  supportsRawArtifacts: false,
  reasonCode: "rpc_unavailable",
  reason: "RPC unavailable"
};
var REASON_CODES = new Set([
  "rpc_unavailable",
  "rpc_failed",
  "no_persistence",
  "no_raw_artifacts",
  "list_failed",
  "http_failed",
  "empty_body"
]);
function asReasonCode(value) {
  return typeof value === "string" && REASON_CODES.has(value) ? value : undefined;
}
function sessionsExportReasonLocaleKey(code) {
  switch (code) {
    case "no_persistence":
      return "sessionsExportNoPersistence";
    case "no_raw_artifacts":
      return "sessionsExportNoRawArtifacts";
    case "list_failed":
      return "sessionsExportListFailed";
    case "rpc_unavailable":
      return "sessionsExportRpcUnavailable";
    case "rpc_failed":
      return "sessionsExportRpcFailed";
    case "http_failed":
      return "sessionsExportHttpFailed";
    case "empty_body":
      return "sessionsExportEmpty";
    default:
      return "sessionsExportUnavailable";
  }
}
function asSessionsExportStatus(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_STATUS };
  }
  const row = value;
  return {
    available: row.available === true,
    sessionCount: typeof row.sessionCount === "number" ? row.sessionCount : 0,
    supportsRawArtifacts: row.supportsRawArtifacts === true,
    reasonCode: asReasonCode(row.reasonCode),
    reason: typeof row.reason === "string" ? row.reason : undefined
  };
}
async function fetchSessionsExportStatus(call, signal) {
  const result = await call(NETXOPS_RPC_CHANNEL, SESSIONS_EXPORT_STATUS_ENDPOINT, {}, signal);
  if (result !== null && typeof result === "object" && result.ok === true) {
    return asSessionsExportStatus(result.value);
  }
  if (result !== null && typeof result === "object" && result.ok === false) {
    return {
      ...EMPTY_STATUS,
      reasonCode: "rpc_failed",
      reason: String(result.error?.message ?? "rpc failed")
    };
  }
  return asSessionsExportStatus(result);
}
function hostBase() {
  const origin = globalThis.location?.origin;
  return origin !== undefined && origin !== "null" ? origin : "http://dsh.internal";
}
function saveBlobDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    globalThis.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 60000);
  }
}

class SessionsExportDownloadError extends Error {
  code;
  status;
  detail;
  constructor(code, message, extra = {}) {
    super(message);
    this.name = "SessionsExportDownloadError";
    this.code = code;
    this.status = extra.status;
    this.detail = extra.detail ?? "";
  }
}
async function downloadAllSessionsExport(fetcher = fetch, save = saveBlobDownload) {
  const url = new URL(NETXOPS_SESSIONS_EXPORT_PATH, hostBase());
  const response = await fetcher(url, {
    method: "GET",
    credentials: "include"
  });
  if (!response.ok) {
    const fromHeader = response.headers.get("x-netxops-export-error") ?? "";
    const detail = fromHeader || await response.text().catch(() => "");
    throw new SessionsExportDownloadError("http_failed", `Export failed: HTTP ${response.status}${detail === "" ? "" : ` ${detail}`}`, { status: response.status, detail });
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const matched = /filename="([^"]+)"/i.exec(disposition);
  const filename = matched?.[1] && matched[1].length > 0 ? matched[1] : "dsh-sessions-export.zip";
  const countHeader = response.headers.get("x-netxops-session-count");
  const sessionCount = countHeader !== null && countHeader !== "" ? Number.parseInt(countHeader, 10) : 0;
  const blob = await response.blob();
  if (blob.size <= 0) {
    throw new SessionsExportDownloadError("empty_body", "Export failed: empty ZIP body");
  }
  save(blob, filename);
  return {
    filename,
    sessionCount: Number.isFinite(sessionCount) ? sessionCount : 0,
    bytes: blob.size
  };
}

// src/client/NetxopsCard.tsx
var jsx_runtime = require("react/jsx-runtime");
function phaseLocaleKey(phase) {
  switch (phase) {
    case "disabled":
      return "alarmPushPhaseDisabled";
    case "idle":
      return "alarmPushPhaseIdle";
    case "connecting":
      return "alarmPushPhaseConnecting";
    case "authenticating":
      return "alarmPushPhaseAuthenticating";
    case "connected":
      return "alarmPushPhaseConnected";
    case "reconnecting":
      return "alarmPushPhaseReconnecting";
    case "auth_failed":
      return "alarmPushPhaseAuthFailed";
    case "error":
      return "alarmPushPhaseError";
    default:
      return "alarmPushPhaseDisabled";
  }
}
function StatusBadge(props) {
  const tone = props.tone ?? (props.phase !== undefined ? alarmPushTone(props.phase) : "neutral");
  const className = tone === "ok" ? "dsh-nx-status dsh-nx-statusOk" : tone === "warn" ? "dsh-nx-status dsh-nx-statusWarn" : tone === "err" ? "dsh-nx-status dsh-nx-statusErr" : "dsh-nx-status";
  return /* @__PURE__ */ jsx_runtime.jsx("span", {
    className,
    children: props.label
  });
}
function kbBadgeLabel(t, snapshot) {
  if (!snapshot || snapshot.status === "unconfigured") {
    return t("kbStatusUnconfigured");
  }
  if (snapshot.status === "error") {
    return fillTemplate(t("kbStatusError"), { detail: snapshot.errorMessage || "error" });
  }
  return fillTemplate(t("kbStatusConfigured"), {
    operator: snapshot.operatorName,
    country: snapshot.country,
    version: snapshot.version
  });
}
function fillTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, name) => Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : match);
}
function exportStatusMessage(t, status) {
  const key = sessionsExportReasonLocaleKey(status.reasonCode);
  const template = t(key);
  if (key === "sessionsExportListFailed") {
    return fillTemplate(template, { detail: status.reason || "" });
  }
  return status.reasonCode ? template : status.reason || template;
}
function exportErrorMessage(t, error) {
  const key = sessionsExportReasonLocaleKey(error.code);
  const template = t(key);
  if (error.code === "http_failed") {
    const detail = error.detail.trim() === "" ? "" : ` ${error.detail.trim()}`;
    return fillTemplate(template, {
      status: error.status !== undefined ? String(error.status) : "",
      detail
    });
  }
  if (error.code === "empty_body")
    return template;
  return error.fallback || template;
}
function ValueField(props) {
  return /* @__PURE__ */ jsx_runtime.jsxs("div", {
    className: "dsh-nx-settings-field",
    children: [
      /* @__PURE__ */ jsx_runtime.jsxs("div", {
        className: "dsh-nx-field-head",
        children: [
          /* @__PURE__ */ jsx_runtime.jsx("label", {
            htmlFor: props.id,
            children: props.label
          }),
          props.field.overridden ? /* @__PURE__ */ jsx_runtime.jsxs("span", {
            className: "dsh-nx-badges",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx("span", {
                className: "dsh-nx-badge",
                children: props.overriddenLabel
              }),
              /* @__PURE__ */ jsx_runtime.jsx("button", {
                type: "button",
                className: "dsh-nx-reset",
                disabled: props.disabled,
                onClick: props.onReset,
                children: props.resetLabel
              })
            ]
          }) : null
        ]
      }),
      /* @__PURE__ */ jsx_runtime.jsx("input", {
        id: props.id,
        className: props.field.invalid ? "dsh-nx-inputInvalid" : undefined,
        type: "text",
        value: props.field.text,
        disabled: props.disabled,
        "aria-invalid": props.field.invalid || undefined,
        onChange: (event) => {
          props.onEdit(event.target.value);
        }
      }),
      /* @__PURE__ */ jsx_runtime.jsx("p", {
        className: props.field.invalid ? "dsh-nx-invalid" : "dsh-nx-hint",
        children: props.field.invalid ? props.invalidLabel : props.hint
      })
    ]
  });
}
function SelectField(props) {
  const known = props.options.some((row) => row.value === props.field.text);
  return /* @__PURE__ */ jsx_runtime.jsxs("div", {
    className: "dsh-nx-settings-field",
    children: [
      /* @__PURE__ */ jsx_runtime.jsxs("div", {
        className: "dsh-nx-field-head",
        children: [
          /* @__PURE__ */ jsx_runtime.jsx("label", {
            htmlFor: props.id,
            children: props.label
          }),
          props.field.overridden ? /* @__PURE__ */ jsx_runtime.jsxs("span", {
            className: "dsh-nx-badges",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx("span", {
                className: "dsh-nx-badge",
                children: props.overriddenLabel
              }),
              /* @__PURE__ */ jsx_runtime.jsx("button", {
                type: "button",
                className: "dsh-nx-reset",
                disabled: props.disabled,
                onClick: props.onReset,
                children: props.resetLabel
              })
            ]
          }) : null
        ]
      }),
      /* @__PURE__ */ jsx_runtime.jsxs("select", {
        id: props.id,
        className: props.field.invalid ? "dsh-nx-inputInvalid" : undefined,
        value: props.field.text,
        disabled: props.disabled,
        "aria-invalid": props.field.invalid || undefined,
        onChange: (event) => {
          props.onEdit(event.target.value);
        },
        children: [
          !known && props.field.text ? /* @__PURE__ */ jsx_runtime.jsx("option", {
            value: props.field.text,
            children: props.field.text
          }) : null,
          props.options.map((row) => /* @__PURE__ */ jsx_runtime.jsx("option", {
            value: row.value,
            children: row.label
          }, row.value))
        ]
      }),
      /* @__PURE__ */ jsx_runtime.jsx("p", {
        className: props.field.invalid ? "dsh-nx-invalid" : "dsh-nx-hint",
        children: props.field.invalid ? props.invalidLabel : props.hint
      })
    ]
  });
}
function ImDeliveryPicker(props) {
  const options = props.catalog.options;
  const selected = resolveImTargets({
    imTargets: props.targetsJson,
    imBotId: props.legacyBotId,
    imTargetId: props.legacyTargetId
  });
  const selectedKeys = new Set(selected.map((row) => imTargetKey(row.botId, row.targetId)));
  const orphanSelected = selected.filter((row) => !options.some((opt) => imCatalogOptionKey(opt.botId, opt.targetId) === imTargetKey(row.botId, row.targetId)));
  return /* @__PURE__ */ jsx_runtime.jsxs("div", {
    className: "dsh-nx-settings-field",
    children: [
      /* @__PURE__ */ jsx_runtime.jsxs("div", {
        className: "dsh-nx-field-head",
        children: [
          /* @__PURE__ */ jsx_runtime.jsx("span", {
            className: "dsh-nx-field-label",
            children: props.labels.target
          }),
          selected.length > 0 ? /* @__PURE__ */ jsx_runtime.jsx("span", {
            className: "dsh-nx-badgeMuted",
            children: props.labels.selectedCount.replace("{count}", String(selected.length))
          }) : null
        ]
      }),
      options.length === 0 && orphanSelected.length === 0 ? /* @__PURE__ */ jsx_runtime.jsx("p", {
        className: "dsh-nx-hint",
        children: !props.catalog.available ? props.catalog.reasonCode ? props.labels.unavailable : props.catalog.hint || props.labels.unavailable : props.labels.none
      }) : /* @__PURE__ */ jsx_runtime.jsxs("div", {
        className: "dsh-nx-imTargetList",
        children: [
          options.map((row) => {
            const key = imCatalogOptionKey(row.botId, row.targetId);
            const checked = selectedKeys.has(key);
            return /* @__PURE__ */ jsx_runtime.jsxs("label", {
              className: "dsh-nx-checkRow",
              children: [
                /* @__PURE__ */ jsx_runtime.jsx("input", {
                  type: "checkbox",
                  checked,
                  disabled: props.disabled,
                  onChange: (event) => {
                    props.onChange(setImTargetSelected(selected, { botId: row.botId, targetId: row.targetId }, event.target.checked));
                  }
                }),
                /* @__PURE__ */ jsx_runtime.jsx("span", {
                  children: `${row.name} · ${row.channel || "im"} · ${row.targetId}`
                })
              ]
            }, key);
          }),
          orphanSelected.map((row) => {
            const key = imTargetKey(row.botId, row.targetId);
            return /* @__PURE__ */ jsx_runtime.jsxs("label", {
              className: "dsh-nx-checkRow",
              children: [
                /* @__PURE__ */ jsx_runtime.jsx("input", {
                  type: "checkbox",
                  checked: true,
                  disabled: props.disabled,
                  onChange: (event) => {
                    props.onChange(setImTargetSelected(selected, row, event.target.checked));
                  }
                }),
                /* @__PURE__ */ jsx_runtime.jsx("span", {
                  children: `${row.botId} · ${row.targetId}`
                })
              ]
            }, `orphan-${key}`);
          })
        ]
      }),
      !props.catalog.available && options.length > 0 ? /* @__PURE__ */ jsx_runtime.jsx("p", {
        className: "dsh-nx-hint",
        children: props.catalog.reasonCode ? props.labels.unavailable : props.catalog.hint || props.labels.unavailable
      }) : null
    ]
  });
}
function CapabilityGroupBlock(props) {
  return /* @__PURE__ */ jsx_runtime.jsxs("div", {
    className: "dsh-nx-groupBlock",
    children: [
      /* @__PURE__ */ jsx_runtime.jsx("div", {
        className: "dsh-nx-groupTitle",
        children: props.title
      }),
      /* @__PURE__ */ jsx_runtime.jsxs("div", {
        className: "dsh-nx-groupChecks",
        children: [
          /* @__PURE__ */ jsx_runtime.jsxs("label", {
            className: "dsh-nx-checkRow",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx("input", {
                type: "checkbox",
                checked: props.inPreset.text === "true",
                disabled: props.disabled,
                onChange: (event) => {
                  props.onEditInPreset(event.target.checked);
                }
              }),
              /* @__PURE__ */ jsx_runtime.jsx("span", {
                children: props.inPresetLabel
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsxs("label", {
            className: "dsh-nx-checkRow",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx("input", {
                type: "checkbox",
                checked: props.published.text === "true",
                disabled: props.disabled,
                onChange: (event) => {
                  props.onEditPublic(event.target.checked);
                }
              }),
              /* @__PURE__ */ jsx_runtime.jsx("span", {
                children: props.publicLabel
              })
            ]
          })
        ]
      })
    ]
  });
}
function ToggleField(props) {
  return /* @__PURE__ */ jsx_runtime.jsxs("div", {
    className: "dsh-nx-settings-field",
    children: [
      /* @__PURE__ */ jsx_runtime.jsxs("div", {
        className: "dsh-nx-field-head",
        children: [
          /* @__PURE__ */ jsx_runtime.jsx("label", {
            htmlFor: props.id,
            children: props.label
          }),
          /* @__PURE__ */ jsx_runtime.jsxs("span", {
            className: "dsh-nx-badges",
            children: [
              props.trailing,
              props.overridden ? /* @__PURE__ */ jsx_runtime.jsxs(jsx_runtime.Fragment, {
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx("span", {
                    className: "dsh-nx-badge",
                    children: props.overriddenLabel
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx("button", {
                    type: "button",
                    className: "dsh-nx-reset",
                    disabled: props.disabled,
                    onClick: props.onReset,
                    children: props.resetLabel
                  })
                ]
              }) : null
            ]
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime.jsx("label", {
        className: "dsh-nx-checkRow",
        htmlFor: props.id,
        children: /* @__PURE__ */ jsx_runtime.jsx("input", {
          id: props.id,
          type: "checkbox",
          checked: props.checked,
          disabled: props.disabled,
          "aria-label": props.label,
          onChange: (event) => {
            props.onToggle(event.target.checked);
          }
        })
      }),
      props.hint,
      props.error
    ]
  });
}
function NetxopsCard(props) {
  ensureStyles();
  const { t } = props;
  const state = props.useNetxopsCard((snapshot) => snapshot);
  const [flash, setFlash] = import_react.useState(null);
  const saveStarted = import_react.useRef(false);
  import_react.useEffect(() => {
    if (state.saving) {
      saveStarted.current = true;
      setFlash(null);
      return;
    }
    if (!saveStarted.current)
      return;
    saveStarted.current = false;
    if (state.failed) {
      setFlash("err");
      return;
    }
    if (!state.dirty)
      setFlash("ok");
  }, [state.dirty, state.failed, state.saving]);
  if (!state.available) {
    return /* @__PURE__ */ jsx_runtime.jsx("section", {
      className: "dsh-nx-settings",
      "aria-label": t("title"),
      children: /* @__PURE__ */ jsx_runtime.jsx("div", {
        className: "dsh-nx-settings-empty",
        children: t("sessionsExportUnavailable")
      })
    });
  }
  const disabled = !state.writable;
  const blocked = !state.dirty || state.invalid || state.saving;
  const pushStatus = state.alarmPushStatus;
  return /* @__PURE__ */ jsx_runtime.jsxs("section", {
    className: "dsh-nx-settings",
    "aria-label": t("title"),
    children: [
      /* @__PURE__ */ jsx_runtime.jsxs("header", {
        children: [
          /* @__PURE__ */ jsx_runtime.jsx("h2", {
            children: t("title")
          }),
          /* @__PURE__ */ jsx_runtime.jsx("p", {
            className: "dsh-nx-settings-intro",
            children: t("description")
          })
        ]
      }),
      !state.writable ? /* @__PURE__ */ jsx_runtime.jsx("p", {
        className: "dsh-nx-hint",
        role: "status",
        children: t("readOnly")
      }) : null,
      /* @__PURE__ */ jsx_runtime.jsxs("div", {
        className: "dsh-nx-settings-card",
        children: [
          /* @__PURE__ */ jsx_runtime.jsx("h3", {
            children: t("sectionConnection")
          }),
          /* @__PURE__ */ jsx_runtime.jsxs("div", {
            className: "dsh-nx-settings-field",
            children: [
              /* @__PURE__ */ jsx_runtime.jsxs("div", {
                className: "dsh-nx-field-head",
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx("label", {
                    htmlFor: "netxops-api-token",
                    children: t("apiToken")
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx("span", {
                    className: "dsh-nx-badges",
                    children: /* @__PURE__ */ jsx_runtime.jsx("span", {
                      className: state.apiTokenConfigured ? "dsh-nx-badge" : "dsh-nx-badgeMuted",
                      children: state.apiTokenConfigured ? t("apiTokenSet") : t("apiTokenUnset")
                    })
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime.jsx("input", {
                id: "netxops-api-token",
                type: "password",
                autoComplete: "off",
                value: state.apiToken.text,
                disabled: !state.apiTokenWritable,
                onChange: (event) => {
                  props.edit("apiToken", event.target.value);
                }
              }),
              /* @__PURE__ */ jsx_runtime.jsx("p", {
                className: "dsh-nx-hint",
                children: state.apiTokenRemoteReady ? t("apiTokenHint") : t("apiTokenUnavailable")
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsx(ValueField, {
            id: "netxops-api-url",
            label: t("apiUrl"),
            hint: t("apiUrlHint"),
            field: state.apiUrl,
            overriddenLabel: t("overridden"),
            resetLabel: t("reset"),
            invalidLabel: t("invalid"),
            disabled,
            onEdit: (text) => {
              props.edit("apiUrl", text);
            },
            onReset: () => {
              props.resetField("apiUrl");
            }
          }),
          /* @__PURE__ */ jsx_runtime.jsx(ValueField, {
            id: "netxops-lang",
            label: t("lang"),
            hint: t("langHint"),
            field: state.lang,
            overriddenLabel: t("overridden"),
            resetLabel: t("reset"),
            invalidLabel: t("invalid"),
            disabled,
            onEdit: (text) => {
              props.edit("lang", text);
            },
            onReset: () => {
              props.resetField("lang");
            }
          }),
          /* @__PURE__ */ jsx_runtime.jsx(SelectField, {
            id: "netxops-thinking-language",
            label: t("thinkingLanguage"),
            hint: t("thinkingLanguageHint"),
            field: state.thinkingLanguage,
            options: [
              { value: "auto", label: "auto" },
              { value: "zh-CN", label: "zh-CN" },
              { value: "en", label: "en" }
            ],
            overriddenLabel: t("overridden"),
            resetLabel: t("reset"),
            invalidLabel: t("invalid"),
            disabled,
            onEdit: (text) => {
              props.edit("thinkingLanguage", text);
            },
            onReset: () => {
              props.resetField("thinkingLanguage");
            }
          }),
          /* @__PURE__ */ jsx_runtime.jsx(SelectField, {
            id: "netxops-reply-language",
            label: t("replyLanguage"),
            hint: t("replyLanguageHint"),
            field: state.replyLanguage,
            options: [
              { value: "follow-user", label: "follow-user" },
              { value: "zh", label: "zh" },
              { value: "en", label: "en" }
            ],
            overriddenLabel: t("overridden"),
            resetLabel: t("reset"),
            invalidLabel: t("invalid"),
            disabled,
            onEdit: (text) => {
              props.edit("replyLanguage", text);
            },
            onReset: () => {
              props.resetField("replyLanguage");
            }
          }),
          /* @__PURE__ */ jsx_runtime.jsx(ValueField, {
            id: "netxops-nms-provider",
            label: t("nmsProvider"),
            hint: t("nmsProviderHint"),
            field: state.nmsProvider,
            overriddenLabel: t("overridden"),
            resetLabel: t("reset"),
            invalidLabel: t("invalid"),
            disabled,
            onEdit: (text) => {
              props.edit("nmsProvider", text);
            },
            onReset: () => {
              props.resetField("nmsProvider");
            }
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime.jsxs("div", {
        className: "dsh-nx-settings-card",
        children: [
          /* @__PURE__ */ jsx_runtime.jsx("h3", {
            children: t("sectionCapabilities")
          }),
          /* @__PURE__ */ jsx_runtime.jsx(CapabilityGroupBlock, {
            title: t("groupOps"),
            inPresetLabel: t("groupInPreset"),
            publicLabel: t("groupPublic"),
            inPreset: state.groupOpsInPreset,
            published: state.groupOpsPublic,
            disabled,
            onEditInPreset: (checked) => {
              props.edit("groupOpsInPreset", checked ? "true" : "false");
            },
            onEditPublic: (checked) => {
              props.edit("groupOpsPublic", checked ? "true" : "false");
            }
          }),
          /* @__PURE__ */ jsx_runtime.jsx(CapabilityGroupBlock, {
            title: t("groupTopology"),
            inPresetLabel: t("groupInPreset"),
            publicLabel: t("groupPublic"),
            inPreset: state.groupTopologyInPreset,
            published: state.groupTopologyPublic,
            disabled,
            onEditInPreset: (checked) => {
              props.edit("groupTopologyInPreset", checked ? "true" : "false");
            },
            onEditPublic: (checked) => {
              props.edit("groupTopologyPublic", checked ? "true" : "false");
            }
          }),
          /* @__PURE__ */ jsx_runtime.jsx(CapabilityGroupBlock, {
            title: t("groupBizMonitor"),
            inPresetLabel: t("groupInPreset"),
            publicLabel: t("groupPublic"),
            inPreset: state.groupBizMonitorInPreset,
            published: state.groupBizMonitorPublic,
            disabled,
            onEditInPreset: (checked) => {
              props.edit("groupBizMonitorInPreset", checked ? "true" : "false");
            },
            onEditPublic: (checked) => {
              props.edit("groupBizMonitorPublic", checked ? "true" : "false");
            }
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime.jsxs("div", {
        className: "dsh-nx-settings-card",
        children: [
          /* @__PURE__ */ jsx_runtime.jsx("h3", {
            children: t("sectionKnowledge")
          }),
          /* @__PURE__ */ jsx_runtime.jsxs("div", {
            className: "dsh-nx-settings-field",
            children: [
              /* @__PURE__ */ jsx_runtime.jsxs("div", {
                className: "dsh-nx-field-head",
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx("label", {
                    htmlFor: "netxops-kb-root",
                    children: t("kbRoot")
                  }),
                  /* @__PURE__ */ jsx_runtime.jsxs("span", {
                    className: "dsh-nx-badges",
                    children: [
                      /* @__PURE__ */ jsx_runtime.jsx(StatusBadge, {
                        tone: kbStatusTone(state.kbStatus?.status ?? "unconfigured"),
                        label: kbBadgeLabel(t, state.kbStatus)
                      }),
                      state.kbRoot.overridden ? /* @__PURE__ */ jsx_runtime.jsxs(jsx_runtime.Fragment, {
                        children: [
                          /* @__PURE__ */ jsx_runtime.jsx("span", {
                            className: "dsh-nx-badge",
                            children: t("overridden")
                          }),
                          /* @__PURE__ */ jsx_runtime.jsx("button", {
                            type: "button",
                            className: "dsh-nx-reset",
                            disabled,
                            onClick: () => {
                              props.resetField("kbRoot");
                            },
                            children: t("reset")
                          })
                        ]
                      }) : null
                    ]
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime.jsxs("div", {
                className: "dsh-nx-pathRow",
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx("input", {
                    id: "netxops-kb-root",
                    className: state.kbRoot.invalid ? "dsh-nx-inputInvalid" : undefined,
                    type: "text",
                    value: state.kbRoot.text,
                    disabled,
                    "aria-invalid": state.kbRoot.invalid || undefined,
                    onChange: (event) => {
                      props.edit("kbRoot", event.target.value);
                    }
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx("button", {
                    type: "button",
                    className: "dsh-nx-btn",
                    disabled,
                    onClick: () => {
                      props.browseKbRoot();
                    },
                    children: t("kbBrowse")
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime.jsx("p", {
                className: state.kbRoot.invalid ? "dsh-nx-invalid" : "dsh-nx-hint",
                children: state.kbRoot.invalid ? t("invalid") : state.kbDirectoryPickerReady ? t("kbRootHint") : t("kbBrowseUnavailable")
              }),
              /* @__PURE__ */ jsx_runtime.jsx("p", {
                className: "dsh-nx-hint",
                children: t("kbSaveHint")
              }),
              state.kbUiError ? /* @__PURE__ */ jsx_runtime.jsx("p", {
                className: "dsh-nx-invalid",
                role: "status",
                children: fillTemplate(t("kbBrowseFailed"), { detail: state.kbUiError })
              }) : null,
              state.kbStatus?.status === "error" && state.kbStatus.errorMessage ? /* @__PURE__ */ jsx_runtime.jsx("p", {
                className: "dsh-nx-invalid",
                role: "status",
                children: state.kbStatus.errorMessage
              }) : null,
              state.kbStatus?.status === "configured" && state.kbStatus.realRoot ? /* @__PURE__ */ jsx_runtime.jsx("p", {
                className: "dsh-nx-hint",
                children: state.kbStatus.realRoot
              }) : null
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsx(CapabilityGroupBlock, {
            title: t("groupKb"),
            inPresetLabel: t("groupInPreset"),
            publicLabel: t("groupPublic"),
            inPreset: state.groupKbInPreset,
            published: state.groupKbPublic,
            disabled,
            onEditInPreset: (checked) => {
              props.edit("groupKbInPreset", checked ? "true" : "false");
            },
            onEditPublic: (checked) => {
              props.edit("groupKbPublic", checked ? "true" : "false");
            }
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime.jsxs("div", {
        className: "dsh-nx-settings-card",
        children: [
          /* @__PURE__ */ jsx_runtime.jsx("h3", {
            children: t("sectionAlarms")
          }),
          /* @__PURE__ */ jsx_runtime.jsx(ToggleField, {
            id: "netxops-alarm-push",
            label: t("alarmPushEnabled"),
            checked: state.alarmPushEnabled.text === "true",
            disabled,
            overridden: state.alarmPushEnabled.overridden,
            overriddenLabel: t("overridden"),
            resetLabel: t("reset"),
            onToggle: (checked) => {
              props.edit("alarmPushEnabled", checked ? "true" : "false");
            },
            onReset: () => {
              props.resetField("alarmPushEnabled");
            },
            trailing: pushStatus ? /* @__PURE__ */ jsx_runtime.jsx(StatusBadge, {
              phase: pushStatus.phase,
              label: `${t("alarmPushStatus")}: ${t(phaseLocaleKey(pushStatus.phase))}`
            }) : null,
            hint: pushStatus?.wsUrl ? /* @__PURE__ */ jsx_runtime.jsx("p", {
              className: "dsh-nx-hint",
              children: pushStatus.wsUrl
            }) : null,
            error: pushStatus?.lastError ? /* @__PURE__ */ jsx_runtime.jsx("p", {
              className: "dsh-nx-invalid",
              role: "status",
              children: pushStatus.lastError
            }) : null
          }),
          /* @__PURE__ */ jsx_runtime.jsx(ToggleField, {
            id: "netxops-alarm-dsh",
            label: t("alarmDeliverDsh"),
            checked: state.alarmDeliverDsh.text === "true",
            disabled,
            overridden: state.alarmDeliverDsh.overridden,
            overriddenLabel: t("overridden"),
            resetLabel: t("reset"),
            onToggle: (checked) => {
              props.edit("alarmDeliverDsh", checked ? "true" : "false");
            },
            onReset: () => {
              props.resetField("alarmDeliverDsh");
            }
          }),
          /* @__PURE__ */ jsx_runtime.jsx(ImDeliveryPicker, {
            catalog: state.imDeliveryCatalog,
            targetsJson: state.imTargets.text,
            legacyBotId: state.imBotId.text,
            legacyTargetId: state.imTargetId.text,
            disabled,
            labels: {
              target: t("alarmDeliverIm"),
              none: t("imTargetNone"),
              selectedCount: t("imTargetSelectedCount"),
              unavailable: t("imCatalogUnavailable")
            },
            onChange: (targets) => {
              props.edit("imTargets", formatImTargetsJson(targets));
              const first = targets[0];
              props.edit("imBotId", first?.botId ?? "");
              props.edit("imTargetId", first?.targetId ?? "");
              props.edit("alarmDeliverIm", targets.length > 0 ? "true" : "false");
            }
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime.jsxs("div", {
        className: "dsh-nx-settings-card",
        children: [
          /* @__PURE__ */ jsx_runtime.jsx("h3", {
            children: t("sectionExport")
          }),
          /* @__PURE__ */ jsx_runtime.jsxs("div", {
            className: "dsh-nx-settings-field",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx("span", {
                className: "dsh-nx-field-label",
                children: t("sessionsExport")
              }),
              state.sessionsExportStatus === null ? /* @__PURE__ */ jsx_runtime.jsx("p", {
                className: "dsh-nx-hint",
                children: t("sessionsExportUnavailable")
              }) : state.sessionsExportStatus.available ? /* @__PURE__ */ jsx_runtime.jsx("p", {
                className: "dsh-nx-hint",
                children: t("sessionsExportCount").replace("{count}", String(state.sessionsExportStatus.sessionCount))
              }) : /* @__PURE__ */ jsx_runtime.jsx("p", {
                className: "dsh-nx-hint",
                children: exportStatusMessage(t, state.sessionsExportStatus)
              }),
              state.sessionsExportError ? /* @__PURE__ */ jsx_runtime.jsx("p", {
                className: "dsh-nx-invalid",
                role: "status",
                children: exportErrorMessage(t, state.sessionsExportError)
              }) : null,
              state.sessionsExportLastFile && !state.sessionsExportBusy && !state.sessionsExportError ? /* @__PURE__ */ jsx_runtime.jsx("p", {
                className: "dsh-nx-hint",
                role: "status",
                children: t("sessionsExportDone").replace("{file}", state.sessionsExportLastFile)
              }) : null,
              /* @__PURE__ */ jsx_runtime.jsx("div", {
                className: "dsh-nx-settings-actions",
                children: /* @__PURE__ */ jsx_runtime.jsx("button", {
                  type: "button",
                  className: "dsh-nx-btn",
                  disabled: state.sessionsExportBusy || state.sessionsExportStatus?.available !== true,
                  onClick: () => {
                    props.exportAllSessions();
                  },
                  children: t(state.sessionsExportBusy ? "sessionsExportBusy" : "sessionsExportButton")
                })
              })
            ]
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime.jsxs("div", {
        className: "dsh-nx-settings-actions",
        children: [
          /* @__PURE__ */ jsx_runtime.jsx("button", {
            type: "button",
            className: "dsh-nx-btn dsh-nx-btn-primary",
            disabled: blocked,
            onClick: props.save,
            children: t(state.saving ? "saving" : "save")
          }),
          /* @__PURE__ */ jsx_runtime.jsx("button", {
            type: "button",
            className: "dsh-nx-btn dsh-nx-btn-ghost",
            disabled: !state.dirty || state.saving,
            onClick: () => {
              props.discard();
              setFlash(null);
            },
            children: t("discard")
          }),
          state.dirty && !state.saving ? /* @__PURE__ */ jsx_runtime.jsx("span", {
            className: "dsh-nx-settings-msg",
            children: t("unsaved")
          }) : null,
          flash === "ok" && !state.dirty ? /* @__PURE__ */ jsx_runtime.jsx("span", {
            className: "dsh-nx-settings-msg ok",
            children: t("configSaved")
          }) : null,
          flash === "err" || state.failed ? /* @__PURE__ */ jsx_runtime.jsx("span", {
            className: "dsh-nx-settings-msg err",
            role: "status",
            children: t("saveFailed")
          }) : null
        ]
      })
    ]
  });
}

// src/client/snapshot-store.ts
function createSnapshotStore(init) {
  let state = init;
  const listeners = new Set;
  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (next) => {
      state = next;
      for (const listener of [...listeners])
        listener();
    }
  };
}

// src/client/card-form.ts
function textField(field) {
  return {
    field,
    format: (value) => typeof value === "string" ? value : "",
    parse: (text) => {
      const trimmed = text.trim();
      return trimmed === "" ? { kind: "clear" } : { kind: "set", value: trimmed };
    }
  };
}
function booleanField(field) {
  return {
    field,
    format: (value) => value === true ? "true" : "false",
    parse: (text) => {
      const normalized = text.trim().toLowerCase();
      if (normalized === "true" || normalized === "1" || normalized === "yes") {
        return { kind: "set", value: true };
      }
      if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "") {
        return { kind: "clear" };
      }
      return;
    }
  };
}
function booleanFieldPersistFalse(field) {
  return {
    field,
    format: (value) => value === true ? "true" : "false",
    parse: (text) => {
      const normalized = text.trim().toLowerCase();
      if (normalized === "true" || normalized === "1" || normalized === "yes") {
        return { kind: "set", value: true };
      }
      if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "") {
        return { kind: "set", value: false };
      }
      return;
    }
  };
}

class CardForm {
  scope;
  specs;
  secretSpecs;
  staged = new Map;
  listeners = new Set;
  saving = false;
  failed = false;
  constructor(scope, specs, secrets = []) {
    this.scope = scope;
    this.specs = new Map(specs.map((spec) => [spec.field, spec]));
    this.secretSpecs = new Map(secrets.map((spec) => [spec.field, spec]));
    scope.subscribe(() => {
      this.publish();
    });
  }
  bind(project) {
    const store = createSnapshotStore(project());
    this.listeners.add(() => {
      store.set(project());
    });
    return store;
  }
  shell() {
    const snapshot = this.scope.getSnapshot();
    const plan = this.plan();
    return {
      available: snapshot.status === "ready",
      writable: snapshot.writable,
      dirty: plan.length > 0,
      invalid: plan.some((item) => item.run === undefined),
      saving: this.saving,
      failed: this.failed
    };
  }
  field(field) {
    const staged = this.staged.get(field);
    if (this.secretSpecs.has(field)) {
      return { text: staged?.text ?? "", overridden: false, invalid: false };
    }
    const spec = this.spec(field);
    if (staged === undefined) {
      return { text: spec.format(this.sectionValue(field)), overridden: this.stored(field), invalid: false };
    }
    const write = staged.clear ? { kind: "clear" } : spec.parse(staged.text);
    return {
      text: staged.text,
      overridden: write?.kind === "set",
      invalid: write === undefined
    };
  }
  actions() {
    return {
      edit: (field, text) => {
        this.stage(field, { text, clear: false });
      },
      resetField: (field) => {
        this.stage(field, { text: this.spec(field).format(this.baseValue(field)), clear: true });
      },
      save: () => {
        this.save();
      },
      discard: () => {
        if (this.staged.size === 0 && !this.failed)
          return;
        this.staged.clear();
        this.failed = false;
        this.publish();
      }
    };
  }
  async save() {
    const plan = this.plan();
    const writes = plan.flatMap((item) => item.run === undefined ? [] : [item.run]);
    if (plan.length === 0 || this.saving || writes.length !== plan.length)
      return;
    this.saving = true;
    this.failed = false;
    this.publish();
    let landed = true;
    for (const write of writes) {
      landed = await write() && landed;
    }
    if (landed)
      this.staged.clear();
    this.saving = false;
    this.failed = !landed;
    this.publish();
  }
  plan() {
    const plan = [];
    for (const [field, staged] of this.staged) {
      const secret = this.secretSpecs.get(field);
      if (secret !== undefined) {
        const value = staged.text.trim();
        if (value !== "")
          plan.push({ field, run: () => secret.write(value) });
        continue;
      }
      const spec = this.spec(field);
      if (staged.clear) {
        if (this.stored(field))
          plan.push({ field, run: () => this.clear(field) });
        continue;
      }
      if (staged.text === spec.format(this.sectionValue(field)))
        continue;
      const write = spec.parse(staged.text);
      if (write === undefined)
        plan.push({ field, run: undefined });
      else if (write.kind === "clear")
        plan.push({ field, run: () => this.clear(field) });
      else
        plan.push({ field, run: () => this.store(field, write.value) });
    }
    return plan;
  }
  async clear(field) {
    await this.scope.unset(field);
    return !this.stored(field);
  }
  async store(field, value) {
    await this.scope.set(field, value);
    return this.sectionValue(field) === value || this.userLayer()?.[field] === value;
  }
  stage(field, edit) {
    this.staged.set(field, edit);
    this.failed = false;
    this.publish();
  }
  spec(field) {
    const spec = this.specs.get(field);
    if (spec === undefined)
      throw new Error(`netxops card has no field ${field}`);
    return spec;
  }
  snapshotOf() {
    return this.scope.getSnapshot();
  }
  sectionValue(field) {
    return this.snapshotOf().value?.[field];
  }
  baseValue(field) {
    return this.snapshotOf().base?.[field];
  }
  userLayer() {
    return this.snapshotOf().user;
  }
  stored(field) {
    const user = this.userLayer();
    return user !== undefined && Object.hasOwn(user, field);
  }
  publish() {
    for (const listener of this.listeners)
      listener();
  }
}

// src/client/controller.ts
var NETXOPS_NS = "netxops";
var DEFAULT_TOKEN_REF = "NETX_API_TOKEN";
var API_TOKEN_FIELD = "apiToken";
var STATUS_POLL_MS = 2000;

class NetxopsCardController {
  scope;
  ctx;
  form;
  store;
  credential = {
    ref: "",
    configured: false,
    writable: false,
    remoteReady: false
  };
  rpcCall;
  alarmPushStatus = null;
  kbStatus = null;
  kbPreview = null;
  kbDirectoryPicker;
  kbBrowseInFlight = false;
  kbStatusInFlight = false;
  kbReloadInFlight = false;
  kbUiError = null;
  lastSyncedKbRoot = undefined;
  imDeliveryCatalog = { ...EMPTY_IM_DELIVERY_CATALOG };
  sessionsExportStatus = null;
  sessionsExportBusy = false;
  sessionsExportError = null;
  sessionsExportLastFile = null;
  pollTimer;
  pollInFlight = false;
  catalogInFlight = false;
  exportStatusInFlight = false;
  exportInFlight;
  constructor(scope, ctx) {
    this.scope = scope;
    this.ctx = ctx;
    this.form = new CardForm(scope, [
      textField("apiUrl"),
      textField("lang"),
      textField("thinkingLanguage"),
      textField("replyLanguage"),
      textField("nmsProvider"),
      textField("kbRoot"),
      booleanFieldPersistFalse("groupOpsInPreset"),
      booleanField("groupOpsPublic"),
      booleanField("groupTopologyInPreset"),
      booleanField("groupTopologyPublic"),
      booleanFieldPersistFalse("groupBizMonitorInPreset"),
      booleanField("groupBizMonitorPublic"),
      booleanFieldPersistFalse("groupKbInPreset"),
      booleanField("groupKbPublic"),
      booleanField("alarmPushEnabled"),
      booleanFieldPersistFalse("alarmDeliverDsh"),
      booleanField("alarmDeliverIm"),
      textField("imTargets"),
      textField("imBotId"),
      textField("imTargetId")
    ], [{ field: API_TOKEN_FIELD, write: (text) => this.writeToken(text) }]);
    this.store = this.form.bind(() => this.projection());
    scope.subscribe(() => {
      this.readCredential();
      this.refreshKbPreview();
      this.syncKbRootFromSettings();
    });
    this.readCredential();
  }
  setCredentialsAvailable(ready) {
    if (this.credential.remoteReady === ready)
      return;
    this.credential = {
      ...this.credential,
      remoteReady: ready,
      writable: ready
    };
    this.store.set(this.projection());
    if (ready)
      this.readCredential();
  }
  setAlarmPushRpc(call) {
    this.rpcCall = call;
    if (call === undefined) {
      this.stopStatusPoll();
      let changed = false;
      if (this.alarmPushStatus !== null) {
        this.alarmPushStatus = null;
        changed = true;
      }
      if (this.kbStatus !== null || this.kbPreview !== null) {
        this.kbStatus = null;
        this.kbPreview = null;
        changed = true;
      }
      if (this.imDeliveryCatalog.options.length > 0 || this.imDeliveryCatalog.available !== true) {
        this.imDeliveryCatalog = { ...EMPTY_IM_DELIVERY_CATALOG };
        changed = true;
      }
      if (this.sessionsExportStatus !== null) {
        this.sessionsExportStatus = null;
        changed = true;
      }
      if (changed)
        this.store.set(this.projection());
      return;
    }
    this.startStatusPoll();
    this.refreshAlarmPushStatus();
    this.reloadKbFromHost();
    this.refreshKbPreview();
    this.refreshImDeliveryCatalog();
    this.refreshSessionsExportStatus();
  }
  setDirectoryPicker(picker) {
    const ready = picker !== undefined;
    if (this.kbDirectoryPicker === picker && this.kbDirectoryPicker !== undefined === ready) {
      return;
    }
    this.kbDirectoryPicker = picker;
    this.store.set(this.projection());
  }
  startStatusPoll() {
    if (this.pollTimer !== undefined)
      return;
    this.pollTimer = setInterval(() => {
      this.refreshAlarmPushStatus();
      this.refreshKbStatus();
      this.refreshImDeliveryCatalog();
      this.refreshSessionsExportStatus();
    }, STATUS_POLL_MS);
  }
  stopStatusPoll() {
    if (this.pollTimer === undefined)
      return;
    clearInterval(this.pollTimer);
    this.pollTimer = undefined;
  }
  async refreshAlarmPushStatus() {
    const call = this.rpcCall;
    if (call === undefined || this.pollInFlight)
      return;
    this.pollInFlight = true;
    try {
      const next = await fetchAlarmPushStatus(call);
      const prev = this.alarmPushStatus;
      if (prev && prev.phase === next.phase && prev.enabled === next.enabled && prev.wsUrl === next.wsUrl && prev.detail === next.detail && prev.lastError === next.lastError && prev.lastConnectedAt === next.lastConnectedAt)
        return;
      this.alarmPushStatus = next;
      this.store.set(this.projection());
    } catch {} finally {
      this.pollInFlight = false;
    }
  }
  async refreshImDeliveryCatalog() {
    const call = this.rpcCall;
    if (call === undefined || this.catalogInFlight)
      return;
    this.catalogInFlight = true;
    try {
      const next = await fetchImDeliveryCatalog(call);
      const prev = this.imDeliveryCatalog;
      const sameOptions = prev.options.length === next.options.length && prev.options.every((row, index) => {
        const other = next.options[index];
        return other && row.botId === other.botId && row.targetId === other.targetId && row.name === other.name && row.channel === other.channel;
      });
      if (prev.available === next.available && prev.hint === next.hint && sameOptions)
        return;
      this.imDeliveryCatalog = next;
      this.store.set(this.projection());
    } catch {} finally {
      this.catalogInFlight = false;
    }
  }
  async refreshSessionsExportStatus() {
    const call = this.rpcCall;
    if (call === undefined || this.exportStatusInFlight)
      return;
    this.exportStatusInFlight = true;
    try {
      const next = await fetchSessionsExportStatus(call);
      const prev = this.sessionsExportStatus;
      if (prev && prev.available === next.available && prev.sessionCount === next.sessionCount && prev.supportsRawArtifacts === next.supportsRawArtifacts && prev.reason === next.reason)
        return;
      this.sessionsExportStatus = next;
      this.store.set(this.projection());
    } catch {} finally {
      this.exportStatusInFlight = false;
    }
  }
  async refreshKbStatus() {
    const call = this.rpcCall;
    if (call === undefined || this.kbStatusInFlight)
      return;
    this.kbStatusInFlight = true;
    try {
      const next = await fetchKbStatus(call);
      this.applyKbSnapshot(next);
    } catch {} finally {
      this.kbStatusInFlight = false;
    }
  }
  async reloadKbFromHost() {
    const call = this.rpcCall;
    if (call === undefined || this.kbReloadInFlight)
      return;
    this.kbReloadInFlight = true;
    try {
      const next = await reloadKbStatus(call);
      this.applyKbSnapshot(next);
      this.lastSyncedKbRoot = (this.scope.getSnapshot().value?.kbRoot ?? "").trim();
    } catch {
      this.refreshKbStatus();
    } finally {
      this.kbReloadInFlight = false;
    }
  }
  applyKbSnapshot(next) {
    const prev = this.kbStatus;
    if (prev && prev.status === next.status && prev.realRoot === next.realRoot && prev.operatorName === next.operatorName && prev.country === next.country && prev.version === next.version && prev.errorMessage === next.errorMessage)
      return;
    this.kbStatus = next;
    this.store.set(this.projection());
  }
  async syncKbRootFromSettings() {
    if (this.rpcCall === undefined)
      return;
    const saved = (this.scope.getSnapshot().value?.kbRoot ?? "").trim();
    if (saved === this.lastSyncedKbRoot)
      return;
    this.lastSyncedKbRoot = saved;
    await this.reloadKbFromHost();
  }
  async refreshKbPreview() {
    const call = this.rpcCall;
    if (call === undefined)
      return;
    const draft = this.form.field("kbRoot").text.trim();
    const saved = (this.scope.getSnapshot().value?.kbRoot ?? "").trim();
    if (draft === saved) {
      if (this.kbPreview !== null) {
        this.kbPreview = null;
        this.store.set(this.projection());
      }
      return;
    }
    try {
      const next = draft === "" ? unconfiguredKbSnapshot() : await resolveKbPath(call, draft);
      const prev = this.kbPreview;
      if (prev && prev.status === next.status && prev.realRoot === next.realRoot && prev.operatorName === next.operatorName && prev.country === next.country && prev.version === next.version && prev.errorMessage === next.errorMessage)
        return;
      this.kbPreview = next;
      this.store.set(this.projection());
    } catch {}
  }
  async commitKbRoot(path) {
    const trimmed = path.trim();
    this.kbUiError = null;
    this.store.set(this.projection());
    await this.form.save();
    const shell = this.form.shell();
    const saved = (this.scope.getSnapshot().value?.kbRoot ?? "").trim();
    if (shell.failed || saved !== trimmed) {
      this.kbUiError = saved === trimmed ? "kbRoot save failed" : `kbRoot save did not land (saved="${saved || "(empty)"}")`;
      this.store.set(this.projection());
      const call = this.rpcCall;
      if (call !== undefined && trimmed !== "") {
        try {
          this.kbPreview = await resolveKbPath(call, trimmed);
          this.store.set(this.projection());
        } catch {}
      }
      return;
    }
    this.kbPreview = null;
    this.lastSyncedKbRoot = undefined;
    await this.reloadKbFromHost();
    this.refreshKbPreview();
  }
  browseKbRoot() {
    if (this.kbBrowseInFlight)
      return;
    this.kbBrowseInFlight = true;
    this.kbUiError = null;
    this.store.set(this.projection());
    const applyPath = (path) => {
      this.form.actions().edit("kbRoot", path);
      this.commitKbRoot(path);
    };
    const fail = (error) => {
      this.kbUiError = error instanceof Error ? error.message : String(error);
      this.store.set(this.projection());
    };
    const acceptPickResult = (result) => {
      const path = unwrapDirectoryPickResult(result);
      if (path === null)
        return;
      if (path === undefined) {
        fail(`unexpected directoryPicker result: ${safeJson(result)}`);
        return;
      }
      applyPath(path);
    };
    const picker = this.kbDirectoryPicker;
    if (picker !== undefined) {
      picker.pick().then(acceptPickResult).catch(fail).finally(() => {
        this.kbBrowseInFlight = false;
        this.store.set(this.projection());
      });
      return;
    }
    const call = this.rpcCall;
    if (call === undefined) {
      this.kbBrowseInFlight = false;
      this.kbUiError = "directory picker unavailable — paste an absolute folder path and Save";
      this.store.set(this.projection());
      return;
    }
    call("/api", "directoryPicker/pick", { args: {} }).then(acceptPickResult).catch(fail).finally(() => {
      this.kbBrowseInFlight = false;
      this.store.set(this.projection());
    });
  }
  exportAllSessions() {
    if (this.exportInFlight !== undefined || this.sessionsExportBusy)
      return;
    if (this.sessionsExportStatus?.available !== true)
      return;
    this.sessionsExportBusy = true;
    this.sessionsExportError = null;
    this.store.set(this.projection());
    this.exportInFlight = downloadAllSessionsExport().then((result) => {
      this.sessionsExportLastFile = result.filename;
      this.sessionsExportError = null;
    }).catch((error) => {
      if (error instanceof SessionsExportDownloadError) {
        this.sessionsExportError = {
          code: error.code,
          status: error.status,
          detail: error.detail,
          fallback: error.message
        };
        return;
      }
      this.sessionsExportError = {
        code: "http_failed",
        detail: "",
        fallback: error instanceof Error ? error.message : String(error)
      };
    }).finally(() => {
      this.sessionsExportBusy = false;
      this.exportInFlight = undefined;
      this.store.set(this.projection());
      this.refreshSessionsExportStatus();
    });
  }
  projection() {
    return {
      ...this.form.shell(),
      apiUrl: this.form.field("apiUrl"),
      lang: this.form.field("lang"),
      thinkingLanguage: this.form.field("thinkingLanguage"),
      replyLanguage: this.form.field("replyLanguage"),
      nmsProvider: this.form.field("nmsProvider"),
      kbRoot: this.form.field("kbRoot"),
      groupOpsInPreset: this.form.field("groupOpsInPreset"),
      groupOpsPublic: this.form.field("groupOpsPublic"),
      groupTopologyInPreset: this.form.field("groupTopologyInPreset"),
      groupTopologyPublic: this.form.field("groupTopologyPublic"),
      groupBizMonitorInPreset: this.form.field("groupBizMonitorInPreset"),
      groupBizMonitorPublic: this.form.field("groupBizMonitorPublic"),
      groupKbInPreset: this.form.field("groupKbInPreset"),
      groupKbPublic: this.form.field("groupKbPublic"),
      alarmPushEnabled: this.form.field("alarmPushEnabled"),
      alarmDeliverDsh: this.form.field("alarmDeliverDsh"),
      alarmDeliverIm: this.form.field("alarmDeliverIm"),
      imTargets: this.form.field("imTargets"),
      imBotId: this.form.field("imBotId"),
      imTargetId: this.form.field("imTargetId"),
      apiToken: this.form.field(API_TOKEN_FIELD),
      apiTokenConfigured: this.credential.configured,
      apiTokenWritable: this.credential.remoteReady && this.credential.writable,
      apiTokenRemoteReady: this.credential.remoteReady,
      alarmPushStatus: this.alarmPushStatus,
      kbStatus: this.kbPreview ?? this.kbStatus,
      kbDirectoryPickerReady: this.kbDirectoryPicker !== undefined || this.rpcCall !== undefined,
      kbUiError: this.kbUiError,
      imDeliveryCatalog: this.imDeliveryCatalog,
      sessionsExportStatus: this.sessionsExportStatus,
      sessionsExportBusy: this.sessionsExportBusy,
      sessionsExportError: this.sessionsExportError,
      sessionsExportLastFile: this.sessionsExportLastFile
    };
  }
  credentials() {
    return this.ctx.get("remote.credentials");
  }
  async readCredential() {
    const ref = refOf(this.scope.getSnapshot());
    const api = this.credentials();
    if (api === undefined) {
      if (ref !== this.credential.ref || this.credential.remoteReady) {
        this.credential = {
          ref,
          configured: false,
          writable: false,
          remoteReady: false
        };
        this.store.set(this.projection());
      }
      return;
    }
    if (ref !== this.credential.ref) {
      this.credential = { ref, configured: false, writable: true, remoteReady: true };
      this.store.set(this.projection());
    }
    const response = await api.describe([ref]);
    if (!response.ok || ref !== refOf(this.scope.getSnapshot()))
      return;
    const view = response.value?.[ref];
    const next = {
      ref,
      configured: view?.configured ?? false,
      writable: view?.writable ?? true,
      remoteReady: true
    };
    if (next.configured === this.credential.configured && next.writable === this.credential.writable && next.remoteReady === this.credential.remoteReady)
      return;
    this.credential = next;
    this.store.set(this.projection());
  }
  refreshCredential(ref) {
    if (ref !== this.credential.ref)
      return;
    this.readCredential();
  }
  inject() {
    const actions = this.form.actions();
    return {
      hooks: { netxopsCard: this.store },
      ...actions,
      edit: (field, text) => {
        actions.edit(field, text);
        if (field === "kbRoot")
          this.refreshKbPreview();
      },
      discard: () => {
        actions.discard();
        this.refreshKbPreview();
      },
      resetField: (field) => {
        actions.resetField(field);
        if (field === "kbRoot")
          this.refreshKbPreview();
      },
      exportAllSessions: () => {
        this.exportAllSessions();
      },
      browseKbRoot: () => {
        this.browseKbRoot();
      }
    };
  }
  async writeToken(value) {
    const api = this.credentials();
    if (api === undefined)
      return false;
    await api.set(refOf(this.scope.getSnapshot()), value);
    await this.readCredential();
    return this.credential.configured;
  }
}
function refOf(snapshot) {
  const declared = snapshot.value?.tokenCredentialRef;
  return declared !== undefined && declared.length > 0 ? declared : DEFAULT_TOKEN_REF;
}
function unwrapDirectoryPickResult(result) {
  if (result === null)
    return null;
  if (typeof result === "string") {
    const trimmed = result.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (result === null || typeof result !== "object" || Array.isArray(result))
    return;
  const row = result;
  if (row.ok === false) {
    throw new Error(row.error?.message || "directoryPicker/pick failed");
  }
  if ("value" in row) {
    if (row.value === null)
      return null;
    if (typeof row.value === "string") {
      const trimmed = row.value.trim();
      return trimmed === "" ? null : trimmed;
    }
    return;
  }
  return;
}
function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// src/client/locales.ts
var en = {
  title: "Netx Ops",
  description: "API, token, capabilities, knowledge base, and alarm delivery.",
  sectionConnection: "Connection",
  sectionCapabilities: "Capability groups",
  sectionKnowledge: "Knowledge base",
  sectionAlarms: "Key-alarm delivery",
  sectionExport: "Session export",
  apiUrl: "API URL",
  apiUrlHint: "e.g. http://127.0.0.1:8890",
  lang: "API / alarm language",
  langHint: "zh / en — netx API query + alarm prompt copy only (not model reply)",
  thinkingLanguage: "Thinking language",
  thinkingLanguageHint: "auto / zh-CN / en — model chain-of-thought for all presets",
  replyLanguage: "Reply language",
  replyLanguageHint: "follow-user / zh / en — final answers for all presets",
  capabilityGroups: "Capability groups",
  nmsProvider: "NMS provider",
  nmsProviderHint: "zte-ume",
  groupOps: "ops",
  groupTopology: "topology",
  groupBizMonitor: "bizMonitor",
  groupKb: "Knowledge skills",
  groupInPreset: "In Netx Ops preset",
  groupPublic: "Publish to other presets",
  kbRoot: "Package root",
  kbRootHint: "Folder with MANIFEST.json (operator-subset v1.0). Browse auto-saves. Pack skills load from paths.skills/_skills and paths.localSkills when hasSkills.",
  kbBrowse: "Browse…",
  kbBrowseUnavailable: "Directory picker unavailable — paste an absolute folder path, then Save.",
  kbBrowseFailed: "Browse failed: {detail}",
  kbSaveHint: "Browse writes and saves automatically, then reloads Host KB status. Manual paste still needs Save.",
  kbStatusConfigured: "Knowledge base: {operator} ({country}) v{version}",
  kbStatusUnconfigured: "Knowledge base: not configured (pure netx)",
  kbStatusError: "Knowledge base: error — {detail}",
  alarmPushEnabled: "Key-alarm push",
  alarmPushStatus: "Status",
  alarmPushPhaseDisabled: "Off",
  alarmPushPhaseIdle: "Idle",
  alarmPushPhaseConnecting: "Connecting…",
  alarmPushPhaseAuthenticating: "Authenticating…",
  alarmPushPhaseConnected: "Connected",
  alarmPushPhaseReconnecting: "Reconnecting…",
  alarmPushPhaseAuthFailed: "Auth failed",
  alarmPushPhaseError: "Error",
  alarmDeliverDsh: "Deliver to DSH session",
  alarmDeliverIm: "Deliver to WhatsApp / IM",
  imTargetNone: "No delivery targets yet — create one in IM delivery settings.",
  imTargetSelectedCount: "{count} selected",
  imCatalogUnavailable: "Cannot load IM targets (install/update dsh-im-ops).",
  apiToken: "API token",
  apiTokenHint: "Stored as NETX_API_TOKEN. Leave blank to keep current.",
  apiTokenUnavailable: "remote.credentials unavailable — set NETX_API_TOKEN via script.",
  apiTokenSet: "Configured",
  apiTokenUnset: "Not set",
  sessionsExport: "Export all sessions",
  sessionsExportCount: "{count} sessions",
  sessionsExportUnavailable: "Export unavailable",
  sessionsExportNoPersistence: "Session store unavailable (JSONL backend required).",
  sessionsExportNoRawArtifacts: "This persistence backend cannot export raw session files.",
  sessionsExportListFailed: "Failed to list sessions: {detail}",
  sessionsExportRpcUnavailable: "Cannot reach Host RPC for export status.",
  sessionsExportRpcFailed: "Export status RPC failed.",
  sessionsExportHttpFailed: "Export failed: HTTP {status}{detail}",
  sessionsExportEmpty: "Export failed: empty ZIP body.",
  sessionsExportButton: "Download ZIP",
  sessionsExportBusy: "Preparing…",
  sessionsExportDone: "Downloaded: {file}",
  overridden: "Overridden",
  reset: "Reset",
  invalid: "Invalid",
  unsaved: "Unsaved changes",
  readOnly: "Read-only",
  saveFailed: "Save failed",
  discard: "Discard",
  save: "Save",
  saving: "Saving…",
  configSaved: "Saved"
};
var zh = {
  title: "Netx Ops",
  description: "API、Token、能力组、知识库与告警投递。",
  sectionConnection: "连接",
  sectionCapabilities: "能力组",
  sectionKnowledge: "知识库",
  sectionAlarms: "关键告警投递",
  sectionExport: "会话导出",
  apiUrl: "API 地址",
  apiUrlHint: "例如 http://127.0.0.1:8890",
  lang: "API / 告警语言",
  langHint: "zh / en — 仅影响 netx API 与告警文案，不控制模型回复",
  thinkingLanguage: "思考语言",
  thinkingLanguageHint: "auto / zh-CN / en — 全预设模型思考过程语言",
  replyLanguage: "回复语言",
  replyLanguageHint: "follow-user / zh / en — 全预设最终回答语言",
  capabilityGroups: "能力组",
  nmsProvider: "NMS 提供方",
  nmsProviderHint: "zte-ume",
  groupOps: "ops",
  groupTopology: "topology",
  groupBizMonitor: "bizMonitor",
  groupKb: "知识库技能",
  groupInPreset: "在 Netx Ops 预设中启用",
  groupPublic: "对其他预设公开",
  kbRoot: "知识包根目录",
  kbRootHint: "含 MANIFEST.json 的运营商子集包（v1.0）。浏览选目录后会自动保存；hasSkills 时加载 paths.skills/_skills 与 paths.localSkills。",
  kbBrowse: "浏览…",
  kbBrowseUnavailable: "目录选择器不可用 — 请粘贴绝对目录路径后点保存。",
  kbBrowseFailed: "浏览失败：{detail}",
  kbSaveHint: "点「浏览」选目录后会自动写入、保存，并刷新宿主知识库状态；若是手粘路径仍需点保存。",
  kbStatusConfigured: "知识库: {operator}（{country}） v{version}",
  kbStatusUnconfigured: "知识库: 未配置（纯 netx）",
  kbStatusError: "知识库: 错误 — {detail}",
  alarmPushEnabled: "关键告警推送",
  alarmPushStatus: "状态",
  alarmPushPhaseDisabled: "未开启",
  alarmPushPhaseIdle: "空闲",
  alarmPushPhaseConnecting: "连接中…",
  alarmPushPhaseAuthenticating: "鉴权中…",
  alarmPushPhaseConnected: "已连接",
  alarmPushPhaseReconnecting: "重连中…",
  alarmPushPhaseAuthFailed: "鉴权失败",
  alarmPushPhaseError: "异常",
  alarmDeliverDsh: "投递到 DSH 会话",
  alarmDeliverIm: "投递到 WhatsApp / IM",
  imTargetNone: "暂无投递目标 — 请先在 IM「投递设置」新建。",
  imTargetSelectedCount: "已选 {count} 个",
  imCatalogUnavailable: "无法加载投递目标（请安装/更新 dsh-im-ops）。",
  apiToken: "API Token",
  apiTokenHint: "写入凭据 NETX_API_TOKEN；留空表示保留已有。",
  apiTokenUnavailable: "未提供 remote.credentials — 请用脚本写入 NETX_API_TOKEN。",
  apiTokenSet: "已配置",
  apiTokenUnset: "未设置",
  sessionsExport: "导出全部会话",
  sessionsExportCount: "{count} 个会话",
  sessionsExportUnavailable: "无法导出",
  sessionsExportNoPersistence: "会话持久化不可用（需要 JSONL 后端）。",
  sessionsExportNoRawArtifacts: "当前持久化后端不支持导出原始会话文件。",
  sessionsExportListFailed: "列出会话失败：{detail}",
  sessionsExportRpcUnavailable: "无法通过 Host RPC 查询导出状态。",
  sessionsExportRpcFailed: "导出状态 RPC 失败。",
  sessionsExportHttpFailed: "导出失败：HTTP {status}{detail}",
  sessionsExportEmpty: "导出失败：ZIP 为空。",
  sessionsExportButton: "下载 ZIP",
  sessionsExportBusy: "准备中…",
  sessionsExportDone: "已下载：{file}",
  overridden: "已覆盖",
  reset: "重置",
  invalid: "无效",
  unsaved: "有未保存更改",
  readOnly: "只读",
  saveFailed: "保存失败",
  discard: "丢弃",
  save: "保存",
  saving: "保存中…",
  configSaved: "已保存"
};

// src/client/index.ts
var LOCALE_NS = "settings.netxops";
var inject = [
  "slots",
  "locale",
  "remote",
  "settingsScope"
];
function apply(ctx) {
  ctx.effect(() => {
    try {
      return ctx.locale.register(LOCALE_NS, { zh, en });
    } catch {
      const offZh = ctx.locale.register(LOCALE_NS, "zh", zh);
      const offEn = ctx.locale.register(LOCALE_NS, "en", en);
      return () => {
        offZh?.();
        offEn?.();
      };
    }
  }, "netxops: locales");
  const card = new NetxopsCardController(ctx.settingsScope.bind({ namespace: NETXOPS_NS }), ctx);
  const t = ctx.locale.bind(LOCALE_NS);
  ctx.inject(["remote.credentials"], (credCtx) => {
    card.setCredentialsAvailable(true);
    credCtx.effect(() => {
      const off = credCtx.remote.$on("credentials/reference-updated", (ref) => {
        card.refreshCredential(String(ref));
      });
      return () => {
        off();
        card.setCredentialsAvailable(false);
      };
    }, "netxops: credential invalidations");
  });
  ctx.inject(["connection"], (connCtx) => {
    const call = connCtx.connection?.rpc?.call?.bind(connCtx.connection.rpc);
    if (typeof call !== "function") {
      connCtx.logger.warn("netxops: connection.rpc.call unavailable — alarm status UI disabled");
      return;
    }
    card.setAlarmPushRpc(call);
    connCtx.effect(() => () => {
      card.setAlarmPushRpc(undefined);
    }, "netxops: clear alarm-push rpc");
  });
  const bindDirectoryPicker = (picker) => {
    if (!picker || typeof picker.pick !== "function")
      return;
    card.setDirectoryPicker(picker);
  };
  bindDirectoryPicker(ctx.remote?.directoryPicker);
  ctx.inject(["remote.directoryPicker"], (dpCtx) => {
    const viaGet = typeof dpCtx.get === "function" ? dpCtx.get("remote.directoryPicker") : undefined;
    const viaNested = dpCtx.remote?.directoryPicker;
    bindDirectoryPicker(viaGet ?? viaNested);
    dpCtx.effect(() => () => {
      card.setDirectoryPicker(undefined);
    }, "netxops: clear directory picker");
  });
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: NETXOPS_NS,
    order: 24,
    label: () => t("title"),
    locale: LOCALE_NS,
    inject: () => card.inject()
  }, NetxopsCard));
}

    return module.exports;
  }
});
