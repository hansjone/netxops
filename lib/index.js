import { createRequire } from "node:module";
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// src/index.ts
import { readFileSync as readFileSync10 } from "node:fs";
import { dirname as dirname8, join as join14 } from "node:path";
import { fileURLToPath as fileURLToPath4 } from "node:url";
import z from "@deepseek-ai/schemastery";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import * as DshSettings from "@deepseek-ai/dsh-settings";

// src/agent-preset-install.ts
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { createRequire as createRequire2 } from "node:module";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
var NETXOPS_PRESET_ID = "netxops";
var DESKTOP_PATCH_BEGIN = "# BEGIN dsh-netxops-preset (managed)";
var DESKTOP_PATCH_END = "# END dsh-netxops-preset (managed)";
var PATCH_PLUGIN_INDENT = "          ";
function packageRoot() {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}
function resolveDshHome() {
  const fromEnv = process.env.DSH_HOME?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0)
    return fromEnv;
  return join(homedir(), ".dsh");
}
function resolveActiveProfile(baseUrl = "") {
  const declared = process.env.DSH_PROFILE?.trim();
  if (declared && /^[\w-]+$/.test(declared))
    return declared;
  const fromBase = /[\\/]profiles[\\/]([\w-]+)[\\/]/.exec(baseUrl)?.[1];
  if (fromBase)
    return fromBase;
  const flag = process.argv.indexOf("--profile");
  if (flag >= 0 && /^[\w-]+$/.test(process.argv[flag + 1] ?? ""))
    return process.argv[flag + 1];
  return process.versions.electron ? "desktop" : "web";
}
function electronResourcesRoots() {
  const roots = [];
  const rp = process.resourcesPath;
  if (typeof rp === "string" && rp.length > 0)
    roots.push(rp);
  roots.push(join(dirname(process.execPath), "resources"));
  return roots;
}
function readableFile(path) {
  try {
    readFileSync(path, { encoding: "utf8", flag: "r" });
    return true;
  } catch {
    return false;
  }
}
function resolveDesktopStandardPatchPath(profile = resolveActiveProfile()) {
  const dshHome = resolveDshHome();
  const envOverride = process.env.NETXOPS_STANDARD_PATCH?.trim();
  const candidates = [];
  if (envOverride)
    candidates.push(envOverride);
  for (const resources of profile === "desktop" ? electronResourcesRoots() : []) {
    candidates.push(join(resources, "app.asar", "dsh", "node_modules", "@deepseek-ai", "dsh-web-app", "presets", "standard.patch.yml"), join(resources, "app.asar.unpacked", "dsh", "node_modules", "@deepseek-ai", "dsh-web-app", "presets", "standard.patch.yml"));
  }
  const requireAnchors = [
    join(dshHome, "profiles", profile, "package.json"),
    join(dshHome, "profiles", profile, "node_modules", "dsh-netxops", "package.json"),
    join(packageRoot(), "package.json"),
    join(dshHome, "profiles", "node_modules", "@deepseek-ai", "dsh-web-app", "package.json")
  ];
  for (const anchor of requireAnchors) {
    if (!existsSync(anchor))
      continue;
    try {
      const req = createRequire2(anchor);
      try {
        candidates.push(req.resolve("@deepseek-ai/dsh-web-app/presets/standard.patch.yml"));
      } catch {}
      const pkg = dirname(req.resolve("@deepseek-ai/dsh-web-app/package.json"));
      candidates.push(join(pkg, "presets", "standard.patch.yml"));
    } catch {}
  }
  for (const path of candidates) {
    if (readableFile(path))
      return path;
  }
  return null;
}
function resolveStandardPresetDir(profile = resolveActiveProfile()) {
  const dshHome = resolveDshHome();
  const candidates = [
    join(dshHome, "profiles", profile, "node_modules", "@deepseek-ai", "dsh-agent-presets", "presets", "standard"),
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "DeepSeekHarness", "packages", "preset", "agent-presets", "presets", "standard"),
    join(dshHome, "profiles", "node_modules", "@deepseek-ai", "dsh-agent-presets", "presets", "standard")
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "agent.cordis.yml")))
      return dir;
  }
  for (const nm of [
    join(dshHome, "profiles", profile, "node_modules"),
    join(dshHome, "profiles", "node_modules")
  ]) {
    const pkgJson = join(nm, "@deepseek-ai", "dsh-agent-presets", "package.json");
    if (!existsSync(pkgJson))
      continue;
    try {
      const req = createRequire2(pkgJson);
      const root = dirname(req.resolve("@deepseek-ai/dsh-agent-presets/package.json"));
      const dir = join(root, "presets", "standard");
      if (existsSync(join(dir, "agent.cordis.yml")))
        return dir;
    } catch {}
  }
  try {
    const req = createRequire2(import.meta.url);
    const root = dirname(req.resolve("@deepseek-ai/dsh-agent-presets/package.json"));
    const dir = join(root, "presets", "standard");
    if (existsSync(join(dir, "agent.cordis.yml")))
      return dir;
  } catch {}
  return null;
}
function desktopRuntimeLikelyPresent() {
  if (typeof process.versions.electron === "string")
    return true;
  for (const resources of electronResourcesRoots()) {
    if (existsSync(join(resources, "app.asar")))
      return true;
  }
  const localAppData = process.env.LOCALAPPDATA?.trim();
  if (localAppData) {
    if (existsSync(join(localAppData, "Programs", "DeepSeek Harness", "resources", "app.asar"))) {
      return true;
    }
  }
  return false;
}
function hostResolveBases(profile = resolveActiveProfile()) {
  const dshHome = resolveDshHome();
  const bases = [];
  for (const resources of profile === "desktop" ? electronResourcesRoots() : []) {
    bases.push(join(resources, "app.asar", "dsh", "package.json"));
    bases.push(join(resources, "app.asar", "dsh", "node_modules"));
  }
  const localAppData = process.env.LOCALAPPDATA?.trim();
  if (localAppData && profile === "desktop") {
    const asarDsh = join(localAppData, "Programs", "DeepSeek Harness", "resources", "app.asar", "dsh");
    bases.push(join(asarDsh, "package.json"), join(asarDsh, "node_modules"));
  }
  bases.push(join(dshHome, "profiles", profile, "package.json"), join(dshHome, "profiles", profile, "node_modules"), join(dshHome, "profiles", "node_modules"), join(packageRoot(), "package.json"));
  return [...new Set(bases.filter((path) => path.includes("app.asar") || existsSync(path)))];
}
function packageInstalledAbove(name, bases) {
  if (name.startsWith("cordis:") || name.startsWith("node:"))
    return true;
  const pkg = name.split("/").slice(0, name.startsWith("@") ? 2 : 1).join("/");
  for (const base of bases) {
    let dir = base.endsWith("package.json") ? dirname(base) : base;
    for (;; ) {
      if (readableFile(join(dir, "node_modules", pkg, "package.json")))
        return true;
      if (readableFile(join(dir, pkg, "package.json")))
        return true;
      const parent = dirname(dir);
      if (parent === dir)
        break;
      dir = parent;
    }
    const requireAnchor = base.endsWith("package.json") ? base : existsSync(join(base, "package.json")) ? join(base, "package.json") : null;
    if (requireAnchor !== null) {
      try {
        createRequire2(requireAnchor).resolve(`${pkg}/package.json`);
        return true;
      } catch {}
    }
  }
  return false;
}
function collectCompositionPackageNames(yaml) {
  const names = [];
  for (const match of yaml.matchAll(/^\s*name:\s*(.+)$/gm)) {
    let raw = match[1].trim();
    if (raw.startsWith("'") && raw.endsWith("'") || raw.startsWith('"') && raw.endsWith('"')) {
      raw = raw.slice(1, -1);
    }
    if (raw.length === 0)
      continue;
    if (raw.startsWith("./") || raw.startsWith("../") || raw.startsWith("file:"))
      continue;
    names.push(raw);
  }
  return [...new Set(names)];
}
function unresolvableCompositionPackages(yaml, bases) {
  return collectCompositionPackageNames(yaml).filter((name) => !packageInstalledAbove(name, bases));
}
function remapWorkflowToPtc(cordis) {
  return cordis.replaceAll("- id: workflow-worker-thread", "- id: workflow-ptc").replaceAll("@deepseek-ai/dsh-workflow-worker-thread", "@deepseek-ai/dsh-workflow-ptc");
}
function remapWorkflowToWorkerThread(cordis) {
  return cordis.replaceAll("- id: workflow-ptc", "- id: workflow-worker-thread").replaceAll("@deepseek-ai/dsh-workflow-ptc", "@deepseek-ai/dsh-workflow-worker-thread");
}
function alignWorkflowEngineForHost(cordis, bases, host = "auto") {
  const hasPtc = packageInstalledAbove("@deepseek-ai/dsh-workflow-ptc", bases);
  const hasWorker = packageInstalledAbove("@deepseek-ai/dsh-workflow-worker-thread", bases);
  const desktop = host === "desktop" || host === "auto" && desktopRuntimeLikelyPresent();
  if (hasPtc && !hasWorker)
    return remapWorkflowToPtc(cordis);
  if (hasPtc && hasWorker && desktop)
    return remapWorkflowToPtc(cordis);
  if (!hasPtc && hasWorker && desktop) {
    return remapWorkflowToPtc(cordis);
  }
  if (!hasPtc && !hasWorker && desktop && cordis.includes("workflow-worker-thread")) {
    return remapWorkflowToPtc(cordis);
  }
  if (hasWorker && !hasPtc && !desktop)
    return remapWorkflowToWorkerThread(cordis);
  if (hasWorker && hasPtc && host === "web")
    return remapWorkflowToWorkerThread(cordis);
  return cordis;
}
function extractPluginsBodyFromStandardPatch(patchYaml) {
  const text = patchYaml.replace(/\r\n/g, `
`);
  const marker = /^([ \t]*)plugins:\s*$/m;
  const match = marker.exec(text);
  if (match === null) {
    throw new Error("standard.patch.yml has no plugins: block");
  }
  const pluginsKeyIndent = match[1].length;
  const start = match.index + match[0].length;
  const rest = text.slice(start).replace(/^\n/, "");
  const lines = rest.split(`
`);
  const body = [];
  for (const line of lines) {
    if (line.trim() === "") {
      body.push(line);
      continue;
    }
    const indent = line.match(/^[ \t]*/)?.[0].length ?? 0;
    if (indent <= pluginsKeyIndent)
      break;
    body.push(line);
  }
  while (body.length > 0 && body[body.length - 1].trim() === "")
    body.pop();
  return body.join(`
`);
}
function pluginsBodyToAgentCordis(pluginsBody) {
  const normalized = pluginsBody.replace(/\r\n/g, `
`);
  const prefix = /^([ \t]*)-\s/m.exec(normalized)?.[1];
  if (prefix === undefined)
    throw new Error("standard preset plugins must be a YAML list");
  return `${pluginsBody.replace(/\r\n/g, `
`).split(`
`).map((line) => {
    if (line.length === 0)
      return "";
    if (line.startsWith(prefix))
      return line.slice(prefix.length);
    throw new Error("standard preset plugins have inconsistent indentation");
  }).join(`
`).trimEnd()}
`;
}
function agentCordisToPluginsBody(agentCordis) {
  return agentCordis.replace(/\r\n/g, `
`).split(`
`).map((line) => line.length === 0 ? "" : `${PATCH_PLUGIN_INDENT}${line}`).join(`
`);
}
function replaceTopLevelEntry(cordis, id, replacement) {
  const lines = cordis.replace(/\r\n/g, `
`).split(`
`);
  const start = lines.findIndex((line) => line === `- id: ${id}`);
  const block = replacement.replace(/\r\n/g, `
`).trimEnd().split(`
`);
  if (start < 0) {
    return `${cordis.replace(/\r\n/g, `
`).trimEnd()}

${block.join(`
`)}
`;
  }
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("- id:"))
    end += 1;
  while (end > start + 1 && lines[end - 1].trim() === "")
    end -= 1;
  return [...lines.slice(0, start), ...block, "", ...lines.slice(end)].join(`
`).replace(/\n{3,}/g, `

`);
}
function ensureNetxopsToolsRow(cordis) {
  if (/^- id: netxops-tools$/m.test(cordis))
    return cordis;
  const row = `- id: netxops-tools
  name: dsh-netxops/tools`;
  if (/^- id: tool-skill$/m.test(cordis)) {
    const lines = cordis.replace(/\r\n/g, `
`).split(`
`);
    const start = lines.findIndex((line) => line === "- id: tool-skill");
    let end = start + 1;
    while (end < lines.length && !lines[end].startsWith("- id:"))
      end += 1;
    while (end > start + 1 && lines[end - 1].trim() === "")
      end -= 1;
    return [...lines.slice(0, end), "", ...row.split(`
`), "", ...lines.slice(end)].join(`
`).replace(/\n{3,}/g, `

`);
  }
  return `${cordis.replace(/\r\n/g, `
`).trimEnd()}

${row}
`;
}
function personaEntryFromMarkdown(md) {
  const body = md.replace(/\r\n/g, `
`).replace(/^#[^\n]*\n+/u, "").replace(/\n+$/u, "");
  const indented = body.split(`
`).map((line) => `      ${line}`).join(`
`);
  return [
    "- id: persona",
    "  name: '@deepseek-ai/dsh-persona'",
    "  config:",
    "    suffix: Your working directory is {{cwd}}.",
    "    # Body from presets/netxops/PERSONA.md (composed onto standard).",
    "    prefix: |-",
    indented
  ].join(`
`);
}
function readPresetMeta(metaPath) {
  const metaText = readFileSync(metaPath, "utf8");
  return {
    name: (metaText.match(/^name:\s*(.+)$/m) || [])[1]?.trim() || "Netx Ops",
    description: (metaText.match(/^description:\s*(.+)$/m) || [])[1]?.trim() || "",
    order: (metaText.match(/^order:\s*(\d+)/m) || [])[1] || "50"
  };
}
function composeNetxopsPresetArtifacts(profile = resolveActiveProfile(), standardDocument) {
  const overlayRoot = join(packageRoot(), "presets", NETXOPS_PRESET_ID);
  const personaPath = join(overlayRoot, "PERSONA.md");
  const metaPath = join(overlayRoot, "preset.yml");
  if (!existsSync(personaPath) || !existsSync(metaPath)) {
    throw new Error(`bundled preset overlay missing under ${overlayRoot}`);
  }
  const meta = readPresetMeta(metaPath);
  const bases = hostResolveBases(profile);
  const patchPath = standardDocument === undefined ? resolveDesktopStandardPatchPath(profile) : null;
  const usePatch = patchPath !== null && process.env.NETXOPS_PREFER_DESKTOP_PATCH !== "0" && (typeof process.versions.electron === "string" || process.env.NETXOPS_PREFER_DESKTOP_PATCH === "1" || profile === "desktop" || resolveStandardPresetDir(profile) === null);
  let standardSource;
  let standardKind;
  let standardDir;
  let agentCordis;
  if (standardDocument !== undefined) {
    if (!standardDocument.trim())
      throw new Error("Host standard preset composition is empty");
    standardSource = `Host ${profile}: standard preset`;
    standardKind = "host-registry";
    standardDir = null;
    agentCordis = standardDocument;
  } else if (usePatch && patchPath !== null) {
    standardSource = patchPath;
    standardKind = "desktop-patch";
    standardDir = null;
    agentCordis = pluginsBodyToAgentCordis(extractPluginsBodyFromStandardPatch(readFileSync(patchPath, "utf8")));
  } else {
    const dir = resolveStandardPresetDir(profile);
    if (dir === null) {
      throw new Error("cannot find host standard preset (Desktop standard.patch.yml or @deepseek-ai/dsh-agent-presets)");
    }
    standardSource = dir;
    standardKind = "directory";
    standardDir = dir;
    agentCordis = readFileSync(join(dir, "agent.cordis.yml"), "utf8");
  }
  agentCordis = replaceTopLevelEntry(agentCordis, "persona", personaEntryFromMarkdown(readFileSync(personaPath, "utf8")));
  agentCordis = ensureNetxopsToolsRow(agentCordis);
  if (standardDocument === undefined) {
    agentCordis = alignWorkflowEngineForHost(agentCordis, bases, profile === "desktop" ? "desktop" : "web");
  }
  if (!agentCordis.endsWith(`
`))
    agentCordis += `
`;
  const missing = (standardDocument === undefined ? unresolvableCompositionPackages(agentCordis, bases) : []).filter((name) => !name.startsWith("dsh-netxops"));
  const desktopAsar = profile === "desktop" && desktopRuntimeLikelyPresent();
  const blocking = missing.filter((name) => !(desktopAsar && name.startsWith("@deepseek-ai/")));
  if (blocking.length > 0) {
    throw new Error(`composed Netx Ops preset names packages the host cannot resolve: ${blocking.join(", ")} ` + `(standard-source: ${standardSource})`);
  }
  const pluginsBody = agentCordisToPluginsBody(agentCordis);
  const declarativePatch = `# Declarative Netx Ops preset for Desktop 0.2 (@deepseek-ai/dsh-agent-preset).
# Generated from host \`standard\` + presets/netxops overlays — do not hand-edit.
# Regenerate: bun run scripts/gen-preset-patch.mjs

- insert:
    - id: preset-netxops
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: netxops
        order: ${meta.order}
        name: ${JSON.stringify(meta.name)}
        description: ${JSON.stringify(meta.description)}
        plugins:
${pluginsBody}
`;
  return { standardSource, standardKind, standardDir, ...meta, agentCordis, declarativePatch };
}
function installDirectoryPreset(artifacts, logger) {
  const overlayRoot = join(packageRoot(), "presets", NETXOPS_PRESET_ID);
  const destParent = join(resolveDshHome(), ".agent-presets");
  const dest = join(destParent, NETXOPS_PRESET_ID);
  mkdirSync(destParent, { recursive: true });
  const marker = join(dest, ".dsh-netxops-managed");
  if (existsSync(dest) && !existsSync(marker)) {
    logger.warn("netxops: preserving user-managed preset at %s", dest);
    return;
  }
  const existed = existsSync(dest);
  mkdirSync(dest, { recursive: true });
  if (!existed && artifacts.standardDir !== null && existsSync(artifacts.standardDir)) {
    cpSync(artifacts.standardDir, dest, { recursive: true });
  }
  let hashes = {};
  if (existsSync(marker)) {
    try {
      hashes = JSON.parse(readFileSync(marker, "utf8")).files ?? {};
    } catch {}
  }
  const hash = (text) => createHash("sha256").update(text).digest("hex");
  const files = {
    "preset.yml": readFileSync(join(overlayRoot, "preset.yml"), "utf8"),
    "PERSONA.md": readFileSync(join(overlayRoot, "PERSONA.md"), "utf8"),
    "agent.cordis.yml": artifacts.agentCordis
  };
  for (const [name, content] of Object.entries(files)) {
    const path = join(dest, name);
    if (existed && existsSync(path)) {
      const current = readFileSync(path, "utf8");
      if (current === content) {
        hashes[name] = hash(content);
        continue;
      }
      if (hash(current) !== hashes[name]) {
        logger.warn("netxops: preserving edited preset file %s", path);
        continue;
      }
    }
    writeFileSync(path, content, "utf8");
    hashes[name] = hash(content);
  }
  writeFileSync(marker, `${JSON.stringify({ standardSource: artifacts.standardSource, files: hashes }, null, 2)}
`, "utf8");
  logger.info("netxops: directory preset composed from %s → %s", artifacts.standardSource, dest);
}
function syncDeclarativeIntoProfilePatch(profileName, declarativePatch, logger) {
  if (!/^[\w-]+$/.test(profileName))
    throw new Error("invalid Host profile name");
  const profileDir = join(resolveDshHome(), "profiles", profileName);
  const patchPath = join(profileDir, "cordis.patch.yml");
  if (!existsSync(profileDir))
    return;
  const original = existsSync(patchPath) ? readFileSync(patchPath, "utf8") : `[]
`;
  let patch = original;
  patch = stripManagedPresetBlocks(patch);
  if (/^\s*-\s+id:\s*(?:preset-netxops|"preset-netxops"|'preset-netxops')\s*(?:#.*)?$/m.test(patch)) {
    logger.warn("netxops: preserving user-declared preset-netxops in %s", patchPath);
    return;
  }
  const contentLines = patch.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => !/^\s*(?:#.*)?$/.test(line) && !/^(?:---|\.\.\.)[ \t]*(?:#.*)?$/.test(line));
  if (contentLines.length === 1 && /^\[\][ \t]*(?:#.*)?$/.test(contentLines[0])) {
    patch = patch.replace(/^\uFEFF/, "").replace(/^\[\][ \t]*(#.*)?$/m, (_line, comment) => comment ?? "");
  } else if (contentLines.length > 0 && !/^\s*-\s/.test(contentLines[0])) {
    throw new Error("profile patch must be a YAML block list; preserving the existing document");
  }
  patch = patch.replace(/^\.\.\.[ \t]*(#.*)?$/gm, (_line, comment) => comment ?? "");
  if (!patch.endsWith(`
`) && patch.length > 0)
    patch += `
`;
  const managed = `${DESKTOP_PATCH_BEGIN}
${declarativePatch.trimEnd()}
${DESKTOP_PATCH_END}
`;
  const next = `${patch}${managed}`;
  if (next === original)
    return;
  if (existsSync(patchPath) && readFileSync(patchPath, "utf8") !== original) {
    logger.warn("netxops: profile patch changed during preset installation; preserving %s", patchPath);
    return;
  }
  const temporary = join(profileDir, `.netxops-patch-${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, next, { encoding: "utf8", flag: "wx" });
    if ((existsSync(patchPath) ? readFileSync(patchPath, "utf8") : `[]
`) !== original) {
      logger.warn("netxops: profile patch changed during preset installation; preserving %s", patchPath);
      return;
    }
    renameSync(temporary, patchPath);
  } finally {
    if (existsSync(temporary))
      unlinkSync(temporary);
  }
  logger.info("netxops: declarative preset synced into profiles/%s/cordis.patch.yml (restart %s to load)", profileName, profileName === "desktop" ? "Desktop" : "dsh web");
}
function stripManagedPresetBlocks(patch) {
  let out = patch;
  for (;; ) {
    const start = out.indexOf(DESKTOP_PATCH_BEGIN);
    if (start < 0)
      break;
    const end = out.indexOf(DESKTOP_PATCH_END, start);
    if (end < 0) {
      throw new Error("unterminated managed preset block; preserving profile patch");
    }
    let cut = end + DESKTOP_PATCH_END.length;
    if (out[cut] === "\r")
      cut += 1;
    if (out[cut] === `
`)
      cut += 1;
    out = `${out.slice(0, start)}${out.slice(cut)}`;
  }
  return out;
}
function ensureAgentPresetInstalled(logger, profile = resolveActiveProfile(), standardDocument) {
  let artifacts;
  try {
    artifacts = composeNetxopsPresetArtifacts(profile, standardDocument);
  } catch (error) {
    logger.warn("netxops: skip preset install: %s", error);
    return;
  }
  try {
    installDirectoryPreset(artifacts, logger);
  } catch (error) {
    logger.error("netxops: failed to install directory preset: %s", error);
  }
  try {
    syncDeclarativeIntoProfilePatch(profile, artifacts.declarativePatch, logger);
  } catch (error) {
    logger.error("netxops: failed to sync declarative preset into profile patch: %s", error);
  }
}
// src/netx/heal-profile-entry.ts
import { existsSync as existsSync2, readFileSync as readFileSync2, statSync, writeFileSync as writeFileSync2 } from "node:fs";
var HOST_HEAL_ONCE = Symbol.for("dsh-netxops.host-bridge-heal-attempted");
var NETXOPS_HOST_CONFIG_DEFAULTS = Object.freeze({
  toolsEnabled: true,
  groupOpsPresets: "",
  groupTopologyPresets: "",
  groupBizMonitorPresets: "",
  groupKbPresets: "",
  apiUrl: "http://127.0.0.1:8890",
  lang: "zh",
  thinkingLanguage: "auto",
  replyLanguage: "follow-user",
  nmsProvider: "zte-ume",
  tokenCredentialRef: "NETX_API_TOKEN",
  toolCallTimeoutMs: 120000,
  installAgentPreset: true,
  alarmPushEnabled: false,
  alarmDeliverDsh: true,
  alarmDeliverIm: false,
  imBotId: "",
  imTargetId: "",
  imTargets: "",
  groupOpsInPreset: true,
  groupOpsPublic: false,
  groupTopologyInPreset: false,
  groupTopologyPublic: false,
  groupBizMonitorInPreset: true,
  groupBizMonitorPublic: false,
  kbRoot: "",
  groupKbInPreset: true,
  groupKbPublic: false,
  disabledTools: "[]",
  readOnlyOnly: false
});
function mergeHostConfigForHeal(existing) {
  const out = { ...existing };
  for (const [key, value] of Object.entries(NETXOPS_HOST_CONFIG_DEFAULTS)) {
    if (!Object.hasOwn(out, key))
      out[key] = value;
  }
  return out;
}
function writePatchIfUnchanged(patchPath, expectedRaw, nextRaw) {
  if (nextRaw === expectedRaw)
    return false;
  const existed = existsSync2(patchPath);
  const mtimeMs = existed ? statSync(patchPath).mtimeMs : 0;
  const current = existed ? readFileSync2(patchPath, "utf8") : "";
  if (current !== expectedRaw)
    return false;
  if (existed && statSync(patchPath).mtimeMs !== mtimeMs)
    return false;
  writeFileSync2(patchPath, nextRaw, "utf8");
  return true;
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

// src/netx/i18n.ts
var ZH = {
  "alarm.sessionTitle": "Netx 关键告警",
  "alarm.defaultLabel": "关键告警",
  "alarm.action.inserted": "告警产生",
  "alarm.action.updated": "告警更新",
  "alarm.action.deleted": "告警清除",
  "alarm.action.fallback": "告警",
  "alarm.field.device": "设备",
  "alarm.field.object": "对象",
  "alarm.field.severity": "级别",
  "alarm.field.cause": "原因",
  "alarm.field.time": "时间",
  "alarm.analyzeHint": "请分析这条关键告警并给出下一步运维建议。"
};
var EN = {
  "alarm.sessionTitle": "Netx key alarm",
  "alarm.defaultLabel": "Key alarm",
  "alarm.action.inserted": "Alarm Raised",
  "alarm.action.updated": "Alarm Updated",
  "alarm.action.deleted": "Alarm Cleared",
  "alarm.action.fallback": "Alarm",
  "alarm.field.device": "Device",
  "alarm.field.object": "Object",
  "alarm.field.severity": "Severity",
  "alarm.field.cause": "Cause",
  "alarm.field.time": "Time",
  "alarm.analyzeHint": "Please analyze this key alarm and suggest next ops steps."
};
var TABLES = {
  zh: ZH,
  en: EN
};
function normalizeNetxLocale(lang) {
  const normalized = String(lang ?? "").trim().toLowerCase();
  if (normalized === "english" || /^en(?:[-_].*)?$/u.test(normalized))
    return "en";
  return "zh";
}
function tHost(key, lang = "zh", vars) {
  const locale = normalizeNetxLocale(lang);
  const template = TABLES[locale][key] ?? TABLES.zh[key] ?? key;
  if (vars === undefined)
    return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match);
}
function alarmActionLabel(action, lang) {
  const normalized = String(action ?? "").trim().toLowerCase();
  if (normalized === "inserted")
    return tHost("alarm.action.inserted", lang);
  if (normalized === "updated")
    return tHost("alarm.action.updated", lang);
  if (normalized === "deleted")
    return tHost("alarm.action.deleted", lang);
  return normalized || tHost("alarm.action.fallback", lang);
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
  if (url.protocol !== "http:" && url.protocol !== "https:")
    return "";
  if (url.username || url.password)
    return "";
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/v1/integrations/dsh-alarm/ws";
  url.search = "";
  url.hash = "";
  url.username = "";
  url.password = "";
  return url.toString();
}
function formatAlarmPrompt(payload, lang = "zh") {
  const action = String(payload.action ?? "").trim().toLowerCase();
  const ne = payload.ne && typeof payload.ne === "object" ? payload.ne : {};
  const host = String(ne.host_name ?? "").trim();
  const ip = String(ne.ip_address ?? "").trim();
  const neName = String(ne.ne_name ?? ne.user_label ?? "").trim();
  let device = host || neName || String(payload.ne_id ?? "").trim() || "-";
  if (ip)
    device = device === "-" ? ip : `${device} (${ip})`;
  const label = String(payload.rule_label ?? payload.native_probable_cause ?? tHost("alarm.defaultLabel", lang)).trim();
  return [
    `[NMS ${alarmActionLabel(action, lang)}] ${label}`,
    `${tHost("alarm.field.device", lang)}: ${device}`,
    `${tHost("alarm.field.object", lang)}: ${String(payload.object_name ?? "-").trim()}`,
    `${tHost("alarm.field.severity", lang)}: ${String(payload.perceived_severity ?? "-").trim()}`,
    `${tHost("alarm.field.cause", lang)}: ${String(payload.native_probable_cause ?? "-").trim()}`,
    `${tHost("alarm.field.time", lang)}: ${String(payload.time_created ?? "-").trim()}`,
    `notificationId: ${String(payload.notification_id ?? "-").trim()}`,
    `alarm_key: ${String(payload.alarm_key ?? "-").trim()}`,
    "",
    tHost("alarm.analyzeHint", lang)
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
      let clientLabel = "netxops";
      try {
        const env = typeof process !== "undefined" ? process.env : undefined;
        const hostname = env?.HOSTNAME || env?.COMPUTERNAME;
        if (typeof hostname === "string" && hostname.trim()) {
          clientLabel = `netxops@${hostname.trim()}`;
        }
      } catch {}
      socket?.send(JSON.stringify({ type: "auth", token, client: clientLabel }));
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
import { homedir as homedir2 } from "node:os";
import { join as join2 } from "node:path";
var PRESET_ID = "netxops";
var PERMISSION_PRESET = "default";
var sticky = null;
var deliveryChain = Promise.resolve();
function resolveWorkspacePath() {
  const fromEnv = process.env.DSH_HOME?.trim();
  const home = fromEnv && fromEnv.length > 0 ? fromEnv : join2(homedir2(), ".dsh");
  return join2(home, "workspaces", "netxops-alarms");
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
    await createStickySession(ctx, prompt, lang);
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
async function createStickySession(ctx, prompt, lang = "zh") {
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
      sessionTitle.rename(handle.agent.session, tHost("alarm.sessionTitle", lang));
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

// src/netx/alarm-dispatch.ts
async function dispatchAlarmToSinks(ctx, payload, options, sinks = {}) {
  const toSession = sinks.toSession ?? deliverAlarmToSession;
  const toIm = sinks.toIm ?? deliverAlarmToIm;
  const jobs = [];
  if (options.deliverDsh) {
    jobs.push(toSession(ctx, payload, options.lang));
  }
  const imOptions = {
    enabled: options.deliverIm,
    targets: options.imTargets,
    lang: options.lang
  };
  jobs.push(toIm(ctx, payload, imOptions));
  const results = await Promise.allSettled(jobs);
  for (const result of results) {
    if (result.status === "rejected") {
      ctx.logger.warn("netxops alarm-push: sink failed: %s", result.reason);
    }
  }
  return results;
}

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
function capabilityGroupsFromSettings(fields) {
  const src = readConfigSnapshot(fields ?? {});
  let opsInPreset = true;
  if (typeof src.groupOpsInPreset === "boolean") {
    opsInPreset = src.groupOpsInPreset;
  } else {
    const legacy = [
      src.groupNmsInPreset,
      src.groupCommonInPreset,
      src.groupManagedNeInPreset
    ].filter((v) => typeof v === "boolean");
    if (legacy.length > 0) {
      opsInPreset = legacy.some((v) => v === true);
    }
  }
  let bizMonitorInPreset = true;
  if (typeof src.groupBizMonitorInPreset === "boolean") {
    bizMonitorInPreset = src.groupBizMonitorInPreset;
  }
  return {
    ops: {
      inPreset: opsInPreset,
      public: (() => {
        if (typeof src.groupOpsPublic === "boolean")
          return src.groupOpsPublic;
        const legacy = [
          src.groupNmsPublic,
          src.groupCommonPublic,
          src.groupManagedNePublic
        ].filter((v) => typeof v === "boolean");
        if (legacy.length === 0)
          return false;
        return legacy.some((v) => v === true);
      })(),
      ...src.groupOpsPresets ? { presets: parsePresetIds(src.groupOpsPresets) } : {}
    },
    topology: {
      inPreset: typeof src.groupTopologyInPreset === "boolean" ? src.groupTopologyInPreset : src.groupTopologyLayoutInPreset === true,
      public: typeof src.groupTopologyPublic === "boolean" ? src.groupTopologyPublic : src.groupTopologyLayoutPublic === true,
      ...src.groupTopologyPresets ? { presets: parsePresetIds(src.groupTopologyPresets) } : {}
    },
    bizMonitor: {
      inPreset: bizMonitorInPreset,
      public: src.groupBizMonitorPublic === true,
      ...src.groupBizMonitorPresets ? { presets: parsePresetIds(src.groupBizMonitorPresets) } : {}
    }
  };
}
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

// src/netx/group-skills.ts
import { readdir, readFile, stat } from "node:fs/promises";
import { join as join4 } from "node:path";

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
  if (JSON.stringify(state.connection) === JSON.stringify(next))
    return;
  state.connection = next;
  for (const listener of [...state.listeners]) {
    try {
      listener();
    } catch (error) {
      console.error("netxops: connection subscriber failed", error);
    }
  }
}
function getNetxConnection() {
  return store2().connection;
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
  const state = store2();
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

// src/netx/skills-cache.ts
import { createHash as createHash2 } from "node:crypto";
import {
  existsSync as existsSync3,
  mkdirSync as mkdirSync2,
  readdirSync,
  readFileSync as readFileSync3,
  rmSync,
  statSync as statSync2,
  writeFileSync as writeFileSync3
} from "node:fs";
import { homedir as homedir3 } from "node:os";
import { dirname as dirname2, join as join3 } from "node:path";
var STALE_CACHE_MS = 30 * 24 * 60 * 60 * 1000;
function dshHome() {
  const fromEnv = process.env.DSH_HOME?.trim();
  return fromEnv || join3(homedir3(), ".dsh");
}
function normalizeSkillsApiUrl(apiUrl) {
  const normalized = normalizeApiUrl(apiUrl);
  return normalized.ok ? normalized.url : apiUrl.trim().replace(/\/$/, "");
}
function skillsCacheKey(apiUrl) {
  const base = normalizeSkillsApiUrl(apiUrl);
  return createHash2("sha256").update(base).digest("hex").slice(0, 16);
}
function cacheParent() {
  return join3(dshHome(), "netxops-mcp-skills");
}
function skillsCacheDir(apiUrl) {
  return join3(cacheParent(), skillsCacheKey(apiUrl));
}
function tokenFingerprint(token) {
  const raw = token.trim();
  return raw ? createHash2("sha256").update(raw).digest("hex").slice(0, 16) : "";
}
function readMeta(root) {
  try {
    const meta = JSON.parse(readFileSync3(join3(root, ".meta.json"), "utf8"));
    return meta && typeof meta === "object" && !Array.isArray(meta) ? meta : null;
  } catch {
    return null;
  }
}
function usableSkillsCacheDir(apiUrl, token) {
  if (!apiUrl.trim())
    return "";
  const root = skillsCacheDir(apiUrl);
  const pulledWith = readMeta(root)?.tokenFp;
  if (pulledWith && pulledWith !== tokenFingerprint(token))
    return "";
  return root;
}
function cachedUnavailableTools(root) {
  const raw = readMeta(root)?.unavailableTools;
  const out = {};
  if (!raw || typeof raw !== "object")
    return out;
  for (const group of CAPABILITY_GROUP_IDS) {
    const names = raw[group];
    if (Array.isArray(names))
      out[group] = names.filter((n) => typeof n === "string");
  }
  return out;
}
function pruneStaleCaches(keep) {
  const parent = cacheParent();
  let entries;
  try {
    entries = readdirSync(parent);
  } catch {
    return;
  }
  const now = Date.now();
  for (const name of entries) {
    const dir = join3(parent, name);
    if (dir === keep)
      continue;
    try {
      const listedAt = Date.parse(readMeta(dir)?.listedAt ?? "");
      const age = now - (Number.isFinite(listedAt) ? listedAt : statSync2(dir).mtimeMs);
      if (age > STALE_CACHE_MS)
        rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
}
function isSafeSegment(value) {
  return Boolean(value) && !value.includes("..") && !value.includes("/") && !value.includes("\\") && !value.includes("\x00");
}
function isSafeRelPath(relPath) {
  if (!relPath || relPath.startsWith("/") || relPath.includes("\x00"))
    return false;
  const parts = relPath.replace(/\\/g, "/").split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}
function replaceSkillsCache(apiUrl, files, options = {}) {
  const root = skillsCacheDir(apiUrl);
  rmSync(root, { recursive: true, force: true });
  mkdirSync2(root, { recursive: true });
  let written = 0;
  const unavailableTools = {};
  for (const file of files) {
    if (file.unavailableTools?.length && SKILL_DIR_BY_GROUP[file.group]) {
      const merged = new Set([...unavailableTools[file.group] ?? [], ...file.unavailableTools]);
      unavailableTools[file.group] = [...merged].sort();
    }
    const groupDir = SKILL_DIR_BY_GROUP[file.group];
    if (!groupDir || !isSafeSegment(file.skill) || !isSafeRelPath(file.relPath))
      continue;
    const rel = file.relPath.replace(/\\/g, "/");
    const dest = join3(root, groupDir, file.skill, ...rel.split("/"));
    mkdirSync2(dirname2(dest), { recursive: true });
    const text = file.text.replace(/\r\n/g, `
`).replace(/\r/g, `
`);
    writeFileSync3(dest, text, "utf8");
    written += 1;
  }
  const normalized = normalizeSkillsApiUrl(apiUrl);
  const meta = {
    apiUrl: normalized,
    mcpUrl: normalized ? `${normalized}/mcp` : "",
    listedAt: new Date().toISOString(),
    fileCount: written,
    ...options.token !== undefined ? { tokenFp: tokenFingerprint(options.token) } : {},
    unavailableTools
  };
  writeFileSync3(join3(root, ".meta.json"), `${JSON.stringify(meta, null, 2)}
`, "utf8");
  summaryMemo.delete(root);
  pruneStaleCaches(root);
  return root;
}
function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir)) {
    const full = join3(dir, entry);
    n += statSync2(full).isDirectory() ? countFiles(full) : 1;
  }
  return n;
}
var summaryMemo = new Map;
function listCachedSkills(apiUrl, token = "") {
  const root = usableSkillsCacheDir(apiUrl, token);
  if (!root || !existsSync3(root))
    return { listedAt: null, skills: [] };
  const metaListedAt = readMeta(root)?.listedAt;
  const listedAt = typeof metaListedAt === "string" ? metaListedAt : null;
  const memo = summaryMemo.get(root);
  if (memo && memo.listedAt === listedAt)
    return memo;
  const skills = [];
  for (const group of CAPABILITY_GROUP_IDS) {
    const groupDir = join3(root, SKILL_DIR_BY_GROUP[group]);
    if (!existsSync3(groupDir))
      continue;
    try {
      for (const name of readdirSync(groupDir).sort()) {
        const dir = join3(groupDir, name);
        if (!statSync2(dir).isDirectory() || !existsSync3(join3(dir, "SKILL.md")))
          continue;
        skills.push({ group, name, files: countFiles(dir) });
      }
    } catch {}
  }
  const listing = { listedAt, skills };
  summaryMemo.set(root, listing);
  return listing;
}

// src/netx/mcp-types.ts
var NETX_TOOL_PREFIX = "netx__";
function publicToolName(serverName) {
  return `${NETX_TOOL_PREFIX}${serverName}`;
}

// src/netx/group-skills.ts
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
  const skillPath = join4(dir, "SKILL.md");
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
  const groupDir = join4(skillsRoot, SKILL_DIR_BY_GROUP[groupId]);
  let entries;
  try {
    entries = await readdir(groupDir);
  } catch {
    return { skills: [], skipped: [{ directory: groupDir, reason: "missing group dir" }] };
  }
  const skills = [];
  const skipped = [];
  for (const entry of entries) {
    const full = join4(groupDir, entry);
    let isDir = false;
    try {
      isDir = (await stat(full)).isDirectory();
    } catch {
      continue;
    }
    if (!isDir)
      continue;
    const skillPath = join4(full, "SKILL.md");
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

## Unavailable tools
The following tools are disabled or not granted to this token: ${list}. Do not call them; skip steps that need them.
` : `

## 不可用工具
以下工具已禁用或当前 token 无权使用：${list}，不要调用，涉及它们的步骤请跳过。
`;
}
function resolveSkillsRoot(options) {
  if (typeof options.skillsRoot === "string" && options.skillsRoot.trim()) {
    return options.skillsRoot.trim();
  }
  const connection = getNetxConnection();
  if (!connection?.apiUrl?.trim())
    return "";
  return usableSkillsCacheDir(connection.apiUrl, connection.token ?? "");
}
async function registerGroupSkills(ctx, groupIds, providerLabel, signalOrOptions) {
  const options = signalOrOptions instanceof AbortSignal || signalOrOptions === undefined ? { signal: signalOrOptions } : signalOrOptions;
  const signal = options.signal;
  const skillsApi = ctx.skills;
  if (!skillsApi || typeof skillsApi.register !== "function") {
    return () => {};
  }
  const root = resolveSkillsRoot(options);
  const disposers = [];
  const enabled = new Set(groupIds);
  const log = ctx.logger;
  if (!root) {
    if (enabled.size > 0) {
      log?.warn?.("%s: no MCP skills cache (missing apiUrl)", providerLabel);
    }
    return () => {};
  }
  const unavailable = cachedUnavailableTools(root);
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
        log?.warn?.("%s: no skills loaded for group=%s from %s", providerLabel, groupId, join4(root, SKILL_DIR_BY_GROUP[groupId]));
      }
      const offNames = new Set([
        ...options.disabledByGroup?.[groupId] ?? [],
        ...(unavailable[groupId] ?? []).map(publicToolName)
      ]);
      const footnote = disabledFootnote([...offNames].sort(), options.lang);
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
import { readdirSync as readdirSync3, readFileSync as readFileSync5, statSync as statSync5 } from "node:fs";
import { join as join7 } from "node:path";

// src/netx/kb-manifest.ts
import { existsSync as existsSync4, readdirSync as readdirSync2, readFileSync as readFileSync4, statSync as statSync3 } from "node:fs";
import { basename, dirname as dirname3, join as join5, resolve } from "node:path";
var EMPTY_CONTENT = {
  hasRegions: false,
  hasTheory: false,
  hasPacket: false,
  hasCommon: false,
  hasSkills: false
};
var LEGACY_CONTENT_KEY = {
  regions: "hasRegions",
  theory: "hasTheory",
  packet: "hasPacket",
  skills: "hasSkills",
  common: "hasCommon"
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
function errorSnapshot(message) {
  return {
    status: "error",
    realRoot: "",
    operatorName: "",
    country: "",
    version: "",
    content: { ...EMPTY_CONTENT },
    paths: {},
    errorMessage: message
  };
}
function findManifest(kbRoot, maxDepth = 3) {
  const root = resolve(kbRoot.trim());
  if (!kbRoot.trim()) {
    return { paths: [], error: "kbRoot is empty" };
  }
  let rootStat;
  try {
    rootStat = statSync3(root);
  } catch {
    return { paths: [], error: `kbRoot not found: ${root}` };
  }
  if (!rootStat.isDirectory()) {
    return { paths: [], error: `kbRoot is not a directory: ${root}` };
  }
  const direct = join5(root, "MANIFEST.json");
  if (existsSync4(direct)) {
    try {
      if (statSync3(direct).isFile())
        return { paths: [direct] };
    } catch {}
  }
  const found = [];
  const walk = (dir, depth) => {
    if (depth > maxDepth)
      return;
    const candidate = join5(dir, "MANIFEST.json");
    if (existsSync4(candidate)) {
      try {
        if (statSync3(candidate).isFile())
          found.push(candidate);
      } catch {}
    }
    if (depth === maxDepth)
      return;
    let entries;
    try {
      entries = readdirSync2(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (name === "node_modules" || name === ".git")
        continue;
      const full = join5(dir, name);
      let st;
      try {
        st = statSync3(full);
      } catch {
        continue;
      }
      if (st.isDirectory())
        walk(full, depth + 1);
    }
  };
  let topEntries;
  try {
    topEntries = readdirSync2(root);
  } catch {
    return { paths: [], error: `cannot read kbRoot: ${root}` };
  }
  for (const name of topEntries) {
    if (name === "node_modules" || name === ".git")
      continue;
    const full = join5(root, name);
    let st;
    try {
      st = statSync3(full);
    } catch {
      continue;
    }
    if (st.isDirectory())
      walk(full, 1);
  }
  return { paths: found };
}
function asNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`MANIFEST missing required string field: ${field}`);
  }
  return value.trim();
}
function parseContent(raw) {
  const out = { ...EMPTY_CONTENT };
  if (raw === undefined || raw === null) {
    throw new Error("MANIFEST missing required object field: content");
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("MANIFEST content must be an object");
  }
  const row = raw;
  const present = new Set(Object.keys(row));
  for (const [key, value] of Object.entries(row)) {
    const on = value === true;
    const mapped = LEGACY_CONTENT_KEY[key];
    if (mapped !== undefined) {
      if (on && !present.has(String(mapped)))
        out[mapped] = true;
      continue;
    }
    out[key] = on;
  }
  return out;
}
function parsePaths(raw) {
  if (raw === undefined || raw === null)
    return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("MANIFEST paths must be an object");
  }
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string")
      continue;
    const trimmed = value.trim();
    if (!trimmed)
      continue;
    out[key] = trimmed;
  }
  return out;
}
function parseManifest(raw) {
  let data;
  try {
    data = JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new Error(`MANIFEST is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("MANIFEST root must be an object");
  }
  const row = data;
  if (row.schemaVersion !== "1.0") {
    throw new Error(`unsupported schemaVersion (want "1.0", got ${JSON.stringify(row.schemaVersion)})`);
  }
  if (row.packageType !== "operator-subset") {
    throw new Error(`unsupported packageType (want "operator-subset", got ${JSON.stringify(row.packageType)})`);
  }
  const operator = row.operator;
  if (operator === null || typeof operator !== "object" || Array.isArray(operator)) {
    throw new Error("MANIFEST missing required object field: operator");
  }
  const op = operator;
  return {
    operatorName: asNonEmptyString(op.name, "operator.name"),
    country: asNonEmptyString(op.country, "operator.country"),
    version: asNonEmptyString(row.version, "version"),
    content: parseContent(row.content),
    paths: parsePaths(row.paths)
  };
}
function resolveKbRoot(kbRoot, maxDepth = 3) {
  const trimmed = kbRoot.trim();
  if (!trimmed)
    return unconfiguredKbSnapshot();
  let root = resolve(trimmed);
  try {
    const st = statSync3(root);
    if (st.isFile()) {
      if (basename(root).toLowerCase() === "manifest.json") {
        root = dirname3(root);
      } else {
        return errorSnapshot(`kbRoot is not a directory: ${root}`);
      }
    } else if (!st.isDirectory()) {
      return errorSnapshot(`kbRoot is not a directory: ${root}`);
    }
  } catch {
    return errorSnapshot(`kbRoot not found: ${root}`);
  }
  const located = findManifest(root, maxDepth);
  if (located.error)
    return errorSnapshot(located.error);
  if (located.paths.length === 0) {
    return errorSnapshot(`no MANIFEST.json under ${root} (maxDepth=${maxDepth})`);
  }
  if (located.paths.length > 1) {
    return errorSnapshot(`ambiguous MANIFEST.json (${located.paths.length} hits); pick a unique package root`);
  }
  const manifestPath = located.paths[0];
  let raw;
  try {
    raw = readFileSync4(manifestPath, "utf8");
  } catch (error) {
    return errorSnapshot(`cannot read MANIFEST: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    const parsed = parseManifest(raw);
    return {
      status: "configured",
      realRoot: dirname3(manifestPath),
      operatorName: parsed.operatorName,
      country: parsed.country,
      version: parsed.version,
      content: parsed.content,
      paths: { ...parsed.paths },
      errorMessage: ""
    };
  } catch (error) {
    return errorSnapshot(error instanceof Error ? error.message : String(error));
  }
}
function resolveKbPaths(snapshot) {
  if (snapshot.status !== "configured")
    return [];
  const paths = { skills: "_skills", ...snapshot.paths };
  return Object.entries(paths).filter((entry) => typeof entry[1] === "string" && entry[1].trim() !== "").map(([key, rel]) => {
    const absolute = resolve(snapshot.realRoot, rel);
    return { key, relative: rel, absolute, exists: existsSync4(absolute) };
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
import { existsSync as existsSync5, realpathSync, statSync as statSync4 } from "node:fs";
import { join as join6, relative, resolve as resolve2, sep } from "node:path";
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
    if (existsSync5(checked.absolutePath)) {
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
      if (!statSync4(realFile).isFile()) {
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
  return join6("memories", MEMORY_BUCKET_DIR[bucket]);
}
function suggestionDir(kind) {
  return join6("suggestions", kind);
}
function draftDir(domain) {
  const d = domain?.trim();
  if (!d)
    return "drafts";
  return join6("drafts", sanitizeSlug(d, "misc"));
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
    return join6("refs", "devices", host);
  }
  return join6("refs", area);
}

// src/netx/kb-context-skill.ts
var SKILL_NAME = "kb-context";
var IDENTITY_FILE_MAX = 8000;
var IDENTITY_TOTAL_MAX = 24000;
function readKbIdentity(snapshot) {
  const localRoot = resolveKbLocalRoot(snapshot);
  if (!localRoot)
    return [];
  const dir = join7(localRoot, "identity");
  let names;
  try {
    names = readdirSync3(dir).filter((name) => /\.md$/i.test(name) && !/^readme\.md$/i.test(name)).sort();
  } catch {
    return [];
  }
  const out = [];
  let budget = IDENTITY_TOTAL_MAX;
  for (const name of names) {
    if (budget <= 0)
      break;
    const full = join7(dir, name);
    let text;
    try {
      if (!statSync5(full).isFile())
        continue;
      text = readFileSync5(full, "utf8").replace(/^\uFEFF/, "").trim();
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
  existsSync as existsSync6,
  mkdirSync as mkdirSync3,
  readdirSync as readdirSync4,
  readFileSync as readFileSync6,
  rmSync as rmSync2,
  statSync as statSync6,
  writeFileSync as writeFileSync4
} from "node:fs";
import { dirname as dirname4, join as join8 } from "node:path";
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
  if (existsSync6(target.absolutePath) && !args.overwrite) {
    throw new Error(`file already exists (pass overwrite=true to replace): ${target.relativePath}`);
  }
  mkdirSync3(dirname4(target.absolutePath), { recursive: true });
  const existed = existsSync6(target.absolutePath);
  writeFileSync4(target.absolutePath, args.body.endsWith(`
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
  if (existsSync6(target.absolutePath) && !args.overwrite) {
    throw new Error(`file already exists (pass overwrite=true to replace): ${target.relativePath}`);
  }
  mkdirSync3(dirname4(target.absolutePath), { recursive: true });
  const existed = existsSync6(target.absolutePath);
  writeFileSync4(target.absolutePath, ensureDraftBody(args.body), "utf8");
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
  if (existsSync6(target.absolutePath) && !args.overwrite) {
    throw new Error(`file already exists (pass overwrite=true to replace): ${target.relativePath}`);
  }
  mkdirSync3(dirname4(target.absolutePath), { recursive: true });
  const existed = existsSync6(target.absolutePath);
  writeFileSync4(target.absolutePath, args.body.endsWith(`
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
  if (existsSync6(target.absolutePath) && !args.overwrite) {
    throw new Error(`file already exists (pass overwrite=true to replace): ${target.relativePath}`);
  }
  mkdirSync3(dirname4(target.absolutePath), { recursive: true });
  const existed = existsSync6(target.absolutePath);
  writeFileSync4(target.absolutePath, args.body.endsWith(`
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
  if (!existsSync6(target.absolutePath)) {
    throw new Error(`file not found: ${target.relativePath}`);
  }
  const body = target.writableRoot === "drafts" ? ensureDraftBody(args.body) : args.body.endsWith(`
`) ? args.body : `${args.body}
`;
  writeFileSync4(target.absolutePath, body, "utf8");
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
  if (!existsSync6(target.absolutePath)) {
    throw new Error(`file not found: ${target.relativePath}`);
  }
  rmSync2(target.absolutePath, { force: false });
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
    entries = readdirSync4(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === "." || name === "..")
      continue;
    const full = join8(dir, name);
    let st;
    try {
      st = statSync6(full);
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
    walkFiles(join8(localRoot, r), localRoot, entries);
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
import { readdirSync as readdirSync5, readFileSync as readFileSync7, realpathSync as realpathSync2, statSync as statSync7 } from "node:fs";
import { extname, join as join9, relative as relative2, resolve as resolve3, sep as sep2 } from "node:path";
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
  const st = statSync7(target.absolutePath);
  if (st.isDirectory()) {
    const entries = readdirSync5(target.absolutePath, { withFileTypes: true }).filter((entry) => !SKIP_DIRS.has(entry.name)).map((entry) => {
      if (entry.isDirectory())
        return { name: entry.name, type: "dir" };
      let size;
      try {
        size = statSync7(join9(target.absolutePath, entry.name)).size;
      } catch {}
      return { name: entry.name, type: "file", size };
    }).sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1);
    return { ok: true, kind: "directory", ...target, entries };
  }
  if (!TEXT_EXTENSIONS.has(extname(target.absolutePath).toLowerCase())) {
    throw new Error(`not a text KB file: ${target.relativePath}`);
  }
  const lines = readFileSync7(target.absolutePath, "utf8").replace(/^\uFEFF/, "").replace(/\r\n?/g, `
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
  const text = readFileSync7(path, "utf8").replace(/^\uFEFF/, "");
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
    entries = readdirSync5(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name))
      continue;
    const full = join9(dir, entry.name);
    if (entry.isDirectory()) {
      walkTextFiles(full, out);
      continue;
    }
    if (!entry.isFile() || !TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase()))
      continue;
    try {
      const st = statSync7(full);
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
    const st = statSync7(dir);
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
var STORE_KEY3 = Symbol.for("dsh-netxops.kb-store");
var ENV_KEYS = [
  "KB_ROOT",
  "KB_LOCAL",
  "KB_OPERATOR",
  "KB_COUNTRY",
  "KB_VERSION",
  "KB_CONTENT",
  "KB_PATHS",
  "KB_STATUS"
];
function store3() {
  const root = globalThis;
  let current = root[STORE_KEY3];
  if (current === undefined) {
    current = { snapshot: unconfiguredKbSnapshot(), listeners: new Set };
    root[STORE_KEY3] = current;
  }
  return current;
}
function getKbContext() {
  const snap = store3().snapshot;
  return {
    ...snap,
    content: { ...snap.content },
    paths: { ...snap.paths }
  };
}
function publishKbContext(next, options = {}) {
  const state = store3();
  if (!options.force && JSON.stringify(state.snapshot) === JSON.stringify(next))
    return;
  state.snapshot = {
    ...next,
    content: { ...next.content },
    paths: { ...next.paths }
  };
  for (const listener of [...state.listeners]) {
    try {
      listener();
    } catch (error) {
      console.error("netxops: knowledge subscriber failed", error);
    }
  }
}
function watchKbContext(listener) {
  const state = store3();
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}
function applyKbEnv(snapshot) {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
  process.env.KB_STATUS = snapshot.status;
  if (snapshot.status !== "configured")
    return;
  process.env.KB_ROOT = snapshot.realRoot;
  const local = resolveKbLocalRoot(snapshot);
  if (local)
    process.env.KB_LOCAL = local;
  process.env.KB_OPERATOR = snapshot.operatorName;
  process.env.KB_COUNTRY = snapshot.country;
  process.env.KB_VERSION = snapshot.version;
  process.env.KB_CONTENT = JSON.stringify(snapshot.content);
  process.env.KB_PATHS = JSON.stringify(Object.fromEntries(resolveKbPaths(snapshot).map((row) => [row.key, row.absolute])));
}
function resetKbContext() {
  publishKbContext(unconfiguredKbSnapshot());
  applyKbEnv(unconfiguredKbSnapshot());
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
import { mkdirSync as mkdirSync4, writeFileSync as writeFileSync5 } from "node:fs";
import { homedir as homedir4 } from "node:os";
import { dirname as dirname5, join as join10 } from "node:path";
var KEY = Symbol.for("dsh-netxops.mount-inventory");
function store4() {
  const root = globalThis;
  return root[KEY] ??= { mounts: new Map, contexts: new WeakMap, sequence: 0 };
}
function getToolMountId(ctx, source) {
  const state = store4();
  let id = state.contexts.get(ctx);
  if (id === undefined) {
    id = ++state.sequence;
    state.contexts.set(ctx, id);
  }
  return `${source}:${id}`;
}
function getToolMountStatuses() {
  return [...store4().mounts.values()].map((row) => ({ ...row, groups: [...row.groups], names: [...row.names] }));
}
function getToolMountStatus() {
  const rows = getToolMountStatuses();
  return rows.find((row) => row.plane === "host") ?? rows.at(-1);
}
function persist() {
  try {
    const path = join10(process.env.DSH_HOME?.trim() || join10(homedir4(), ".dsh"), "netxops-mount-status.json");
    mkdirSync4(dirname5(path), { recursive: true });
    writeFileSync5(path, `${JSON.stringify({ mount: getToolMountStatus() ?? null, mounts: getToolMountStatuses() }, null, 2)}
`, "utf8");
  } catch {}
}
function publishToolMountStatus(next) {
  store4().mounts.set(next.id ?? next.source ?? next.plane, { ...next, groups: [...next.groups], names: [...next.names] });
  persist();
}
function removeToolMountStatus(id) {
  store4().mounts.delete(id);
  persist();
}
function resetToolMountStatus() {
  store4().mounts.clear();
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
import { join as join11 } from "node:path";
function kbPackSkillsEnabled(snapshot) {
  return snapshot.status === "configured" && snapshot.content.hasSkills === true;
}
function resolveKbSkillsRoot(snapshot) {
  const rel = snapshot.paths.skills?.trim() || "_skills";
  return join11(snapshot.realRoot, rel);
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
  return join11(snapshot.realRoot, rel);
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
      const full = join11(root, entry);
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

// src/netx/model-language.ts
var THINKING_LANGUAGE_DEFAULT = "auto";
var REPLY_LANGUAGE_DEFAULT = "follow-user";
var THINKING_LANGUAGE_IDS = ["zh-CN", "en"];
var REPLY_LANGUAGE_IDS = ["zh", "en"];
var THINKING_META = {
  "zh-CN": { id: "zh-CN", name: "Simplified Chinese", native: "简体中文" },
  en: { id: "en", name: "English", native: "English" }
};
var REPLY_META = {
  zh: { id: "zh", name: "Simplified Chinese", native: "简体中文" },
  en: { id: "en", name: "English", native: "English" }
};
function normalizeThinkingLanguage(raw) {
  const value = String(raw ?? "").trim();
  if (!value || value === THINKING_LANGUAGE_DEFAULT)
    return THINKING_LANGUAGE_DEFAULT;
  const lower = value.toLowerCase().replace(/_/g, "-");
  if (lower === "zh" || lower === "zh-cn" || lower === "zh-hans" || lower === "chinese")
    return "zh-CN";
  if (lower === "en" || lower.startsWith("en-") || lower === "english")
    return "en";
  if (THINKING_LANGUAGE_IDS.includes(value)) {
    return value;
  }
  return THINKING_LANGUAGE_DEFAULT;
}
function normalizeReplyLanguage(raw) {
  const value = String(raw ?? "").trim();
  if (!value || value === REPLY_LANGUAGE_DEFAULT || value === "auto" || value === "default") {
    return REPLY_LANGUAGE_DEFAULT;
  }
  const lower = value.toLowerCase().replace(/_/g, "-");
  if (lower === "zh" || lower === "zh-cn" || lower === "zh-hans" || lower === "chinese")
    return "zh";
  if (lower === "en" || lower.startsWith("en-") || lower === "english")
    return "en";
  if (REPLY_LANGUAGE_IDS.includes(value)) {
    return value;
  }
  return REPLY_LANGUAGE_DEFAULT;
}
function resolveThinkingLanguage(setting, systemLocale) {
  const normalized = normalizeThinkingLanguage(setting);
  if (normalized !== THINKING_LANGUAGE_DEFAULT)
    return normalized;
  return languageFromLocale(systemLocale) ?? "en";
}
function languageFromLocale(locale) {
  const tag = String(locale ?? "").trim().toLowerCase().replace(/_/g, "-");
  if (!tag)
    return;
  if (tag === "zh" || tag.startsWith("zh-hans") || tag.startsWith("zh-cn") || tag === "zh-sg") {
    return "zh-CN";
  }
  if (tag.startsWith("zh"))
    return "zh-CN";
  if (tag === "en" || tag.startsWith("en-"))
    return "en";
  return;
}
function readSystemLocalePreference(settings) {
  if (!settings || typeof settings.get !== "function")
    return;
  let section;
  try {
    section = settings.get("locale");
  } catch {
    return;
  }
  if (section === null || typeof section !== "object" || Array.isArray(section))
    return;
  const preference = section.preference;
  return typeof preference === "string" && preference.trim() ? preference.trim() : undefined;
}
function thinkingInstruction(language) {
  const meta = THINKING_META[language];
  return [
    `The operator configured the language of your thinking/reasoning process: ${meta.native} (${meta.name}).`,
    `Write your entire internal reasoning — chain-of-thought, analysis, planning, and deliberation — in ${meta.name}.`,
    "Keep code, identifiers, file paths, commands, and technical terms as they are.",
    "Your final answer to the user follows the reply-language setting (or the user language when reply language is follow-user); this thinking setting never alone changes the final answer language."
  ].join(" ");
}
function thinkingReminder(language) {
  const meta = THINKING_META[language];
  return [
    `[Thinking language] The operator wants your reasoning/thinking process written in ${meta.native} (${meta.name}).`,
    `Continue your entire chain-of-thought in ${meta.name}.`,
    "Final answer language follows the reply-language setting / user language."
  ].join(" ");
}
function replyInstruction(setting) {
  const normalized = normalizeReplyLanguage(setting);
  if (normalized === REPLY_LANGUAGE_DEFAULT)
    return "";
  const meta = REPLY_META[normalized];
  const noGloss = normalized === "en" ? 'Never add Chinese glosses or bilingual parentheses such as "communication failure (失联)" or "alarm (告警)"; use one English wording only.' : 'Never add English glosses or bilingual parentheses such as "失联 (communication failure)" or "告警 (alarm)"; use one Chinese wording only.';
  return [
    "## Reply language requirement (mandatory)",
    `The operator set Netx Ops reply language to ${meta.native} (${meta.name}).`,
    `You MUST write the entire final reply in ${meta.name} only.`,
    `Do not switch to the user's language even if they write in Chinese, English, or any other language.`,
    "This includes titles, bullet labels (Result / Evidence / Next may stay as English keywords), explanations, summaries, warnings, and error text.",
    noGloss,
    "Keep code, commands, file paths, API names, host names, UUIDs, and proper nouns unchanged.",
    'This rule outranks persona wording such as "follow the user language" and outranks language hints in the user message.'
  ].join(" ");
}
function replyReminder(setting) {
  const normalized = normalizeReplyLanguage(setting);
  if (normalized === REPLY_LANGUAGE_DEFAULT)
    return "";
  const meta = REPLY_META[normalized];
  const noGloss = normalized === "en" ? "No Chinese words or (中文) glosses in the answer." : "No English glosses like (English term) in the answer.";
  return [
    `[Reply language] Mandatory: write your entire final answer in ${meta.native} (${meta.name}).`,
    noGloss,
    "Code/paths/host names stay original."
  ].join(" ");
}

// src/netx/session-export.ts
import { homedir as homedir5, hostname as osHostname } from "node:os";

// node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/index.mjs
import { createRequire as createRequire3 } from "module";
var require2 = createRequire3("/");
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
function strToU8(str2, latin1) {
  if (latin1) {
    var ar_1 = new u8(str2.length);
    for (var i2 = 0;i2 < str2.length; ++i2)
      ar_1[i2] = str2.charCodeAt(i2);
    return ar_1;
  }
  if (te)
    return te.encode(str2);
  var l = str2.length;
  var ar = new u8(str2.length + (str2.length >> 1));
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
    var c = str2.charCodeAt(i2);
    if (c < 128 || latin1)
      w(c);
    else if (c < 2048)
      w(192 | c >> 6), w(128 | c & 63);
    else if (c > 55295 && c < 57344)
      c = 65536 + (c & 1023 << 10) | str2.charCodeAt(++i2) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
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
      reasonCode: "no_persistence",
      reason: "sessionPersistence unavailable — mount a JSONL session backend (web profile default)"
    };
  }
  if (!persistence.supportsRawArtifacts) {
    return {
      available: false,
      sessionCount: 0,
      supportsRawArtifacts: false,
      reasonCode: "no_raw_artifacts",
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
      reasonCode: "list_failed",
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

// src/netx/netxops-web-rpc.ts
var NETXOPS_RPC_BODY_MAX = 8 * 1024 * 1024;
var ENDPOINT_SEGMENT_PATTERN = /^[A-Za-z0-9_$.-]+$/;
var INVALID_REQUEST_RPC_ID = "invalid-request";
var LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1"]);
function endpointFromPath(channel, pathname) {
  if (!pathname.startsWith(`${channel}/`))
    return;
  const endpoint = pathname.slice(channel.length + 1);
  if (endpoint.split("/").some((seg) => seg === "" || seg === "." || seg === ".." || !ENDPOINT_SEGMENT_PATTERN.test(seg))) {
    return;
  }
  return endpoint;
}
function serverResponseJson(rpcId, result) {
  return JSON.stringify({ type: "server-response", rpcId, result });
}
function isTrustedLoopbackRequest(req) {
  const host = req.headers?.host;
  if (!host)
    return false;
  const hostName = host.split(":")[0];
  if (!LOOPBACK_HOSTNAMES.has(hostName ?? ""))
    return false;
  if (req.headers["sec-fetch-site"] === "cross-site")
    return false;
  const origin = req.headers.origin;
  if (origin === undefined)
    return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
function netxopsFetchHandler(channel, handler, log) {
  return {
    async fetch(request) {
      const endpoint = endpointFromPath(channel, new URL(request.url).pathname);
      if (request.method !== "POST" || endpoint === undefined) {
        return new Response("not found", { status: 404 });
      }
      const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
      if (mediaType !== "application/json") {
        return new Response("content type must be application/json", { status: 415 });
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response("body is not JSON", { status: 400 });
      }
      const row = body;
      const rpcId = row && typeof row.rpcId === "string" ? row.rpcId : INVALID_REQUEST_RPC_ID;
      const method = row && typeof row.method === "string" ? row.method : null;
      if (rpcId === INVALID_REQUEST_RPC_ID || method === null) {
        return new Response(serverResponseJson(INVALID_REQUEST_RPC_ID, {
          ok: false,
          error: { code: "bad-request", message: "invalid client-request message", details: { issues: [] } }
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (method !== endpoint) {
        return new Response(serverResponseJson(rpcId, {
          ok: false,
          error: {
            code: "bad-request",
            message: `method ${JSON.stringify(method)} does not match endpoint ${JSON.stringify(endpoint)}`,
            details: { issues: [] }
          }
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      try {
        const result = await handler(endpoint, row?.payload, request.signal);
        return new Response(serverResponseJson(rpcId, result), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      } catch (error) {
        log.error?.("netxops: rpc %s failed: %s", endpoint, error instanceof Error ? error.message : String(error));
        return new Response(`handler failure: ${String(error)}`, { status: 500 });
      }
    }
  };
}
async function httpBridge(req, res, fetchHandler, maxBodyBytes) {
  const abort = new AbortController;
  res.on("close", () => {
    if (!res.writableEnded)
      abort.abort();
  });
  const declaredLen = req.headers["content-length"];
  if (declaredLen !== undefined && Number(declaredLen) > maxBodyBytes) {
    res.writeHead(413, { connection: "close" });
    res.end();
    req.destroy();
    return;
  }
  const chunks = [];
  let received = 0;
  for await (const chunk of req) {
    const buffer = chunk;
    received += buffer.byteLength;
    if (received > maxBodyBytes) {
      res.writeHead(413, { connection: "close" });
      res.end();
      req.destroy();
      return;
    }
    chunks.push(buffer);
  }
  const url = `http://${req.headers.host ?? "127.0.0.1"}${req.url ?? "/"}`;
  const request = new Request(url, {
    method: req.method ?? "GET",
    headers: Object.fromEntries(Object.entries(req.headers).filter(([, value]) => typeof value === "string")),
    ...chunks.length > 0 ? { body: Buffer.concat(chunks) } : {},
    signal: abort.signal
  });
  const response = await fetchHandler.fetch(request);
  const headers = Object.fromEntries(response.headers.entries());
  res.writeHead(response.status, headers);
  if (response.body === null) {
    res.end();
    return;
  }
  for await (const chunk of response.body) {
    if (!res.write(chunk)) {
      await new Promise((resolve4) => {
        const done = () => {
          res.off("drain", done);
          res.off("close", done);
          resolve4();
        };
        res.once("drain", done);
        res.once("close", done);
      });
    }
  }
  res.end();
}
function mountNetxopsWebRoute(ctx, channel, handler) {
  const webServer = ctx.webServer;
  if (!webServer || typeof webServer.register !== "function")
    return null;
  const connection = ctx.connection;
  const fetchHandler = netxopsFetchHandler(channel, handler, ctx.logger);
  const route = {
    kind: "prefix",
    path: channel,
    handler: async (req, res) => {
      let rejection;
      if (typeof connection?.requestRejection === "function") {
        try {
          rejection = connection.requestRejection(req);
        } catch {
          rejection = 403;
        }
      } else if (!isTrustedLoopbackRequest(req)) {
        rejection = 403;
      }
      if (rejection !== undefined) {
        res.writeHead(rejection, { "content-type": "text/plain; charset=utf-8" });
        res.end(rejection === 401 ? "unauthorized" : "forbidden");
        return;
      }
      await httpBridge(req, res, fetchHandler, NETXOPS_RPC_BODY_MAX);
    }
  };
  const registered = webServer.register(route);
  if (typeof registered === "function") {
    return () => {
      try {
        registered();
      } catch {}
    };
  }
  if (registered && typeof registered.then === "function") {
    let done = false;
    return () => {
      if (done)
        return;
      done = true;
      registered.then((dispose) => {
        if (typeof dispose === "function")
          dispose();
      }).catch(() => {});
    };
  }
  return () => {};
}

// src/netx/tools.ts
import { readFileSync as readFileSync8 } from "node:fs";
import { dirname as dirname6, join as join12 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
import { defineTool as defineTool2 } from "@deepseek-ai/dsh-tools";

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
function parseDisabledTools(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.filter((item) => typeof item === "string" && item.trim().length > 0).map((s) => s.trim()))];
  }
  if (typeof value !== "string")
    return [];
  const trimmed = value.trim();
  if (!trimmed)
    return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return [...new Set(parsed.filter((item) => typeof item === "string" && item.trim().length > 0).map((s) => s.trim()))];
      }
    } catch {}
  }
  return [...new Set(trimmed.split(/[\s,，]+/).filter(Boolean))];
}
function filterCatalogTools(catalog, enabledGroups, policy) {
  const allowGroups = new Set(enabledGroups);
  const disabled = disabledSet(policy.disabledTools);
  const readOnlyOnly = policy.readOnlyOnly === true;
  const out = [];
  for (const tool2 of catalog) {
    if (!tool2.group || !allowGroups.has(tool2.group))
      continue;
    if (disabled.has(tool2.name))
      continue;
    if (readOnlyOnly && tool2.readOnlyHint !== true)
      continue;
    out.push(tool2);
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
  for (const tool2 of catalog) {
    if (!tool2.group || !allowGroups.has(tool2.group))
      continue;
    const off = disabled.has(tool2.name) || readOnlyOnly === true && tool2.readOnlyHint !== true;
    if (off)
      names.push(publicToolName(tool2.name));
  }
  return names.sort();
}

// src/netx/mcp-remote.ts
var PROTOCOL_VERSION = "2025-03-26";
var CLIENT_INFO = { name: "dsh-netxops", version: "0.1.71" };
var SKILLS_URI_PREFIX = "netx://skills/";

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
function isGroupId(value) {
  return typeof value === "string" && CAPABILITY_GROUP_IDS.includes(value);
}
function parseTool(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return null;
  const row = raw;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!name)
    return null;
  const description = typeof row.description === "string" ? row.description : "";
  const inputSchema = row.inputSchema && typeof row.inputSchema === "object" && !Array.isArray(row.inputSchema) ? row.inputSchema : { type: "object", properties: {} };
  const annotations = row.annotations && typeof row.annotations === "object" && !Array.isArray(row.annotations) ? row.annotations : {};
  const readOnlyHint = annotations.readOnlyHint === true;
  const meta = row._meta && typeof row._meta === "object" && !Array.isArray(row._meta) ? row._meta : {};
  const netx = meta.netx && typeof meta.netx === "object" && !Array.isArray(meta.netx) ? meta.netx : {};
  if (netx.group === "meta")
    return null;
  const group = isGroupId(netx.group) ? netx.group : undefined;
  return { name, description, inputSchema, readOnlyHint, group };
}
function readMetaNetx(row) {
  const meta = row._meta ?? row.meta;
  if (!meta || typeof meta !== "object" || Array.isArray(meta))
    return {};
  const netx = meta.netx;
  if (!netx || typeof netx !== "object" || Array.isArray(netx))
    return {};
  return netx;
}
function parseSkillResource(resource, text) {
  if (!resource || typeof resource !== "object" || Array.isArray(resource))
    return null;
  const row = resource;
  const uri = typeof row.uri === "string" ? row.uri.trim() : "";
  const netx = readMetaNetx(row);
  const group = isGroupId(netx.group) ? netx.group : undefined;
  const skill = typeof netx.skill === "string" ? netx.skill.trim() : "";
  if (!group || !skill)
    return null;
  let relPath = typeof row.name === "string" ? row.name.trim().replace(/\\/g, "/") : "";
  if (!relPath && uri.startsWith(SKILLS_URI_PREFIX)) {
    const rest = uri.slice(SKILLS_URI_PREFIX.length);
    const parts = rest.split("/");
    if (parts.length >= 3)
      relPath = parts.slice(2).join("/");
  }
  if (!relPath || relPath.includes(".."))
    return null;
  const unavailableTools = Array.isArray(netx.unavailableTools) ? netx.unavailableTools.filter((n) => typeof n === "string" && n.length > 0) : [];
  return {
    group,
    skill,
    relPath,
    text,
    ...netx.entry === true && unavailableTools.length > 0 ? { unavailableTools } : {}
  };
}
function resourcesCapability(capabilities) {
  if (!capabilities || typeof capabilities !== "object" || Array.isArray(capabilities))
    return false;
  return "resources" in capabilities;
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
    for (let i2 = dataLines.length - 1;i2 >= 0; i2 -= 1) {
      try {
        return JSON.parse(dataLines[i2]);
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
    const err2 = row.error;
    const message = typeof err2.message === "string" ? err2.message : "JSON-RPC error";
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
async function fetchMcpCatalog(options) {
  if (!options.mcpUrl)
    throw new McpRemoteError("mcp url is empty");
  const init = await postRpc(options, "initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: CLIENT_INFO
  });
  await postRpc(options, "notifications/initialized", {}, true);
  const toolsResult = await postRpc(options, "tools/list", {});
  const toolsRaw = Array.isArray(toolsResult?.tools) ? toolsResult.tools : [];
  const tools = [];
  for (const item of toolsRaw) {
    const parsed = parseTool(item);
    if (parsed)
      tools.push(parsed);
  }
  if (!resourcesCapability(init?.capabilities)) {
    return { tools, skills: [] };
  }
  try {
    const listed = await postRpc(options, "resources/list", {});
    const resources = Array.isArray(listed?.resources) ? listed.resources : [];
    const skills = [];
    for (const resource of resources) {
      if (!resource || typeof resource !== "object" || Array.isArray(resource))
        continue;
      const uri = typeof resource.uri === "string" ? resource.uri.trim() : "";
      if (!uri.startsWith(SKILLS_URI_PREFIX))
        continue;
      const read = await postRpc(options, "resources/read", { uri });
      const contents = Array.isArray(read?.contents) ? read.contents : [];
      let text = "";
      for (const block of contents) {
        if (!block || typeof block !== "object" || Array.isArray(block))
          continue;
        const row = block;
        if (typeof row.text === "string") {
          text = row.text;
          break;
        }
      }
      const parsed = parseSkillResource(resource, text);
      if (parsed)
        skills.push(parsed);
    }
    return { tools, skills };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { tools, skillsError: message };
  }
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

// src/netx/mcp-store.ts
var STORE_KEY4 = Symbol.for("dsh-netxops.mcp-catalog-store");
var EMPTY = Object.freeze({
  phase: "idle",
  mcpUrl: "",
  tools: Object.freeze([]),
  error: "",
  listedAt: null,
  fromCache: false
});
function store5() {
  const root = globalThis;
  let current = root[STORE_KEY4];
  if (current === undefined) {
    current = { state: EMPTY, listeners: new Set, generation: 0 };
    root[STORE_KEY4] = current;
  }
  return current;
}
function notify() {
  for (const listener of [...store5().listeners]) {
    try {
      listener();
    } catch (error) {
      console.error("netxops: mcp catalog subscriber failed", error);
    }
  }
}
function publish(next) {
  store5().state = next;
  notify();
}
function getMcpCatalogState() {
  return store5().state;
}
function getMcpCatalogTools() {
  return store5().state.tools;
}
function watchMcpCatalog(listener) {
  const state = store5();
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}
async function refreshMcpCatalog(input) {
  const mcpUrl = mcpEndpointUrl(input.apiUrl);
  const state = store5();
  const gen = ++state.generation;
  const previous = state.state;
  if (!mcpUrl) {
    const next = {
      phase: "error",
      mcpUrl: "",
      tools: previous.tools,
      error: "apiUrl empty",
      listedAt: previous.listedAt,
      fromCache: previous.tools.length > 0
    };
    if (gen === store5().generation)
      publish(next);
    return next;
  }
  publish({
    phase: "connecting",
    mcpUrl,
    tools: previous.tools,
    error: "",
    listedAt: previous.listedAt,
    fromCache: previous.tools.length > 0
  });
  try {
    const fetched = await fetchMcpCatalog({
      mcpUrl,
      token: input.token,
      lang: input.lang,
      timeoutMs: input.timeoutMs,
      signal: input.signal,
      fetchImpl: input.fetchImpl
    });
    if (gen !== store5().generation)
      return store5().state;
    if (fetched.skills !== undefined) {
      replaceSkillsCache(input.apiUrl, fetched.skills, { token: input.token });
    } else {
      console.warn("netxops: mcp skills pull failed, keeping cache — %s", fetched.skillsError);
    }
    const next = {
      phase: "connected",
      mcpUrl,
      tools: Object.freeze([...fetched.tools]),
      error: "",
      listedAt: new Date().toISOString(),
      fromCache: false
    };
    publish(next);
    return next;
  } catch (error) {
    if (gen !== store5().generation)
      return store5().state;
    const message = error instanceof McpRemoteError ? error.message : error instanceof Error ? error.message : String(error);
    const next = {
      phase: previous.tools.length > 0 ? "offline" : "error",
      mcpUrl,
      tools: previous.tools,
      error: message,
      listedAt: previous.listedAt,
      fromCache: previous.tools.length > 0
    };
    publish(next);
    return next;
  }
}

// src/netx/tools.ts
function packageVersion() {
  try {
    const here = dirname6(fileURLToPath2(import.meta.url));
    const pkg = JSON.parse(readFileSync8(join12(here, "..", "package.json"), "utf8"));
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

// src/netx/preset-publication.ts
import { createScope, scopeOf } from "@deepseek-ai/dsh-scope";

// src/netx/group-tools-plugin.ts
import { readFileSync as readFileSync9 } from "node:fs";
import { dirname as dirname7, join as join13 } from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";
function packageVersion2() {
  try {
    const here = dirname7(fileURLToPath3(import.meta.url));
    const pkg = JSON.parse(readFileSync9(join13(here, "..", "package.json"), "utf8"));
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

// src/netx/preset-publication.ts
function installPresetPublication(ctx) {
  ctx.inject(["agents", "agentPresets", "tools"], (child) => {
    const agents = child.get("agents");
    const presets = child.get("agentPresets");
    const mounts = new Map;
    let active = true;
    const release = (id) => {
      const mount = mounts.get(id);
      if (!mount)
        return;
      mounts.delete(id);
      mount.scope.rawDispose();
    };
    const sync = (agent) => {
      if (!active)
        return;
      const presetId = presets.composedPreset(agent.ctx);
      const connection = getNetxConnection();
      const enabled = connection && presetId && presetId !== "netxops" && (groupsForPreset(connection, presetId).length > 0 || kbEnabledForPlane(connection, "preset", presetId));
      const previous = mounts.get(agent.id);
      if (!enabled || previous?.presetId !== presetId)
        release(agent.id);
      if (!enabled || mounts.has(agent.id))
        return;
      const key = scopeOf(agent.ctx);
      if (!key) {
        child.logger.warn("netxops: selected preset %s has no session scope", presetId);
        return;
      }
      const scope = createScope(child, key);
      mounts.set(agent.id, { presetId, scope });
      applyGroupToolsPlugin(scope.ctx, { name: `netxops-selected:${presetId}:${agent.id}`, mode: "settings", presetId });
    };
    const syncAll = () => {
      for (const agent of agents.list())
        sync(agent);
    };
    child.on("agent/created", ({ agent }) => {
      sync(agent);
    });
    child.on("agent/disposed", ({ agent }) => {
      release(agent.id);
    });
    child.on("agent-preset/selected", () => {
      syncAll();
    });
    const stop = watchNetxConnection(syncAll);
    syncAll();
    child.effect(() => () => {
      active = false;
      stop();
      for (const id of [...mounts.keys()])
        release(id);
    }, "netxops: selected preset publication");
  });
}

// src/index.ts
function mcpCatalogPayload(catalog) {
  const connection = getNetxConnection();
  const cached = listCachedSkills(connection?.apiUrl ?? "", connection?.token ?? "");
  return {
    phase: catalog.phase,
    mcpUrl: catalog.mcpUrl,
    error: catalog.error,
    listedAt: catalog.listedAt,
    fromCache: catalog.fromCache,
    tools: catalog.tools.map((tool2) => ({
      name: tool2.name,
      description: tool2.description,
      readOnlyHint: tool2.readOnlyHint,
      group: tool2.group ?? null
    })),
    skills: cached.skills,
    skillsListedAt: cached.listedAt
  };
}
var name = "netxops";
var inject = ["tools"];
var NETXOPS_RPC_CHANNEL = "/netxops";
var NETXOPS_SETTINGS_NAMESPACE = "netxops";
var DEFAULT_TOKEN_REF = "NETX_API_TOKEN";
var DEFAULT_TOOL_CALL_TIMEOUT_MS = 120000;
var DEFAULT_API_URL = "http://127.0.0.1:8890";
var DEFAULT_LANG = "zh";
function vol(schema) {
  const candidate = schema;
  return typeof candidate.volatile === "function" ? candidate.volatile() : schema;
}
var Config = z.object({
  toolsEnabled: vol(z.boolean().default(true)),
  groupOpsPresets: vol(z.string().default("")),
  groupTopologyPresets: vol(z.string().default("")),
  groupBizMonitorPresets: vol(z.string().default("")),
  groupKbPresets: vol(z.string().default("")),
  apiUrl: vol(z.string().default("http://127.0.0.1:8890")),
  lang: vol(z.string().default("zh")),
  thinkingLanguage: vol(z.string().default("auto")),
  replyLanguage: vol(z.string().default("follow-user")),
  tokenCredentialRef: vol(z.string().role("credential-ref").default(DEFAULT_TOKEN_REF)),
  toolCallTimeoutMs: vol(z.number().step(1).min(1000).default(120000)),
  installAgentPreset: vol(z.boolean().default(true)),
  alarmPushEnabled: vol(z.boolean().default(false)),
  alarmDeliverDsh: vol(z.boolean().default(true)),
  alarmDeliverIm: vol(z.boolean().default(false)),
  imTargets: vol(z.string().default("")),
  imBotId: vol(z.string().default("")),
  imTargetId: vol(z.string().default("")),
  nmsProvider: vol(z.string().default("zte-ume")),
  groupOpsInPreset: vol(z.boolean().default(true)),
  groupOpsPublic: vol(z.boolean().default(false)),
  groupTopologyInPreset: vol(z.boolean().default(false)),
  groupTopologyPublic: vol(z.boolean().default(false)),
  groupBizMonitorInPreset: vol(z.boolean().default(true)),
  groupBizMonitorPublic: vol(z.boolean().default(false)),
  kbRoot: vol(z.string().default("")),
  groupKbInPreset: vol(z.boolean().default(true)),
  groupKbPublic: vol(z.boolean().default(false)),
  disabledTools: vol(z.string().default("[]")),
  readOnlyOnly: vol(z.boolean().default(false))
});
function mergeConfigSkippingNullish(base, patch) {
  const live = Object.fromEntries(Object.entries(readConfigSnapshot(patch)).filter(([, v]) => v !== null && v !== undefined));
  return { ...readConfigSnapshot(base), ...live };
}
function resolveToolCallTimeoutMs(value, fallback = DEFAULT_TOOL_CALL_TIMEOUT_MS) {
  value = readConfigValue(value);
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
function resolveLang(value, fallback = DEFAULT_LANG) {
  value = readConfigValue(value);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}
function resolveApiUrlForConnection(value) {
  value = readConfigValue(value);
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    const normalized2 = normalizeApiUrl(DEFAULT_API_URL);
    return {
      url: normalized2.ok ? normalized2.url : DEFAULT_API_URL,
      usedDefault: true
    };
  }
  const normalized = normalizeApiUrl(raw);
  if (normalized.ok)
    return { url: normalized.url, usedDefault: false };
  return { url: "", usedDefault: false, error: normalized.error };
}
function packageVersion3() {
  try {
    const here = dirname8(fileURLToPath4(import.meta.url));
    const pkg = JSON.parse(readFileSync10(join14(here, "..", "package.json"), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "0";
  } catch {
    return "0";
  }
}
function resolveTokenCredentialRef(value) {
  value = readConfigValue(value);
  return typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value.trim()) ? value.trim() : DEFAULT_TOKEN_REF;
}
function credentialsFrom(ctx) {
  const direct = ctx.credentials;
  if (direct && typeof direct.resolve === "function")
    return direct;
  if (typeof ctx.get === "function") {
    const viaGet = ctx.get("credentials");
    if (viaGet && typeof viaGet.resolve === "function")
      return viaGet;
  }
  return;
}
async function resolveToken(ctx, refName, log) {
  const ref = resolveTokenCredentialRef(refName);
  const fromEnv = () => process.env[ref]?.trim() ?? "";
  try {
    const credentials = credentialsFrom(ctx);
    if (!credentials?.resolve) {
      const env2 = fromEnv();
      if (!env2)
        log?.warn("netxops: credentials service unavailable; %s empty", ref);
      return env2;
    }
    const hit = await credentials.resolve(credentialRef(ref));
    const value = typeof hit?.value === "string" ? hit.value.trim() : "";
    if (value)
      return value;
    const env = fromEnv();
    if (!env)
      log?.warn("netxops: credential %s resolve returned empty", ref);
    return env;
  } catch (error) {
    log?.warn("netxops: credential %s resolve failed: %s", ref, error);
    return fromEnv();
  }
}
function describeRows(describe) {
  if (typeof describe !== "function")
    return [];
  try {
    const raw = describe();
    if (Array.isArray(raw))
      return raw;
    if (raw && typeof raw === "object" && Array.isArray(raw.namespaces)) {
      return raw.namespaces;
    }
  } catch {}
  return [];
}
function installNetxopsSettings(ctx, entry, hooks) {
  const legacy = DshSettings.installSettingsSection;
  if (typeof legacy === "function") {
    legacy(ctx, NETXOPS_SETTINGS_NAMESPACE, Config, readConfigSnapshot(entry), hooks);
    return;
  }
  ctx.inject(["settings"], (settingsCtx) => {
    const settings = settingsCtx.settings;
    if (typeof settings.installSection === "function") {
      settings.installSection(ctx, NETXOPS_SETTINGS_NAMESPACE, Config, readConfigSnapshot(entry), hooks);
      return;
    }
    const readLive = () => {
      const row = describeRows(settings.describe).find((item) => item.ns === NETXOPS_SETTINGS_NAMESPACE);
      if (row?.value !== null && typeof row?.value === "object" && !Array.isArray(row.value)) {
        return mergeConfigSkippingNullish(entry, row.value);
      }
      return readConfigSnapshot(entry);
    };
    hooks.setSource(readLive);
    hooks.onChange();
    let lastFingerprint = JSON.stringify(readLive());
    const bumpIfChanged = (reason) => {
      const next = readLive();
      const fingerprint = JSON.stringify(next);
      if (fingerprint === lastFingerprint)
        return;
      lastFingerprint = fingerprint;
      settingsCtx.logger.info("netxops: live settings changed (%s) → republish connection", reason);
      hooks.onChange();
    };
    settingsCtx.effect(() => {
      const onDocumentUpdated = (ns) => {
        if (ns !== NETXOPS_SETTINGS_NAMESPACE && ns !== "dsh-netxops")
          return;
        bumpIfChanged("document-updated");
      };
      const off = settingsCtx.on("settings/document-updated", onDocumentUpdated);
      const timer = setInterval(() => {
        bumpIfChanged("poll");
      }, 2000);
      return () => {
        clearInterval(timer);
        if (typeof off === "function")
          off();
      };
    }, "netxops: settings live follow");
    settingsCtx.logger.info("netxops: hot-following settings (document-updated + describe poll)");
  });
}
function apply(ctx, config = Config({})) {
  let source = () => readConfigSnapshot(config);
  const initial = source();
  let generation = 0;
  let disposed = false;
  let resolvedTokenRef = resolveTokenCredentialRef(initial.tokenCredentialRef);
  let stopAlarmPush;
  let credentialsCtx = ctx;
  if (initial.installAgentPreset) {
    const profile = resolveActiveProfile(ctx.baseUrl);
    let scheduled = false;
    const fallback = setTimeout(() => {
      if (!scheduled && !disposed && source().installAgentPreset) {
        ensureAgentPresetInstalled(ctx.logger, profile);
      }
    }, 1000);
    ctx.inject(["agentPresets"], (presetCtx) => {
      scheduled = true;
      clearTimeout(fallback);
      let active = true;
      const timer = setTimeout(() => {
        (async () => {
          const registry = presetCtx.get("agentPresets");
          let document;
          try {
            document = (await registry.readDocument?.("standard"))?.content;
          } catch (error) {
            presetCtx.logger.warn("netxops: cannot read Host standard preset: %s", error);
          }
          if (active && !disposed && source().installAgentPreset) {
            ensureAgentPresetInstalled(presetCtx.logger, profile, document);
          }
        })().catch((error) => {
          presetCtx.logger.warn("netxops: preset installation failed: %s", error);
        });
      }, 0);
      presetCtx.effect(() => () => {
        active = false;
        clearTimeout(timer);
      }, "netxops: Host standard composition");
    });
    ctx.effect(() => () => {
      clearTimeout(fallback);
    }, "netxops: preset installation fallback");
  }
  const connectionSnapshot = (current, token) => {
    const resolved = resolveApiUrlForConnection(current.apiUrl);
    if (resolved.error) {
      ctx.logger.warn("netxops: invalid apiUrl (%s) — using empty url until fixed; use http(s) without embedded credentials", resolved.error);
    } else if (resolved.usedDefault) {
      ctx.logger.warn("netxops: apiUrl missing/null in settings — falling back to %s", resolved.url);
    }
    return {
      toolsEnabled: current.toolsEnabled !== false,
      groupKbPresets: current.groupKbPresets ?? "",
      apiUrl: resolved.url,
      token,
      lang: resolveLang(current.lang),
      toolCallTimeoutMs: resolveToolCallTimeoutMs(current.toolCallTimeoutMs),
      groups: capabilityGroupsFromSettings(current),
      disabledTools: parseDisabledTools(current.disabledTools),
      readOnlyOnly: current.readOnlyOnly === true,
      groupKbInPreset: typeof current.groupKbInPreset === "boolean" ? current.groupKbInPreset : true,
      groupKbPublic: current.groupKbPublic === true
    };
  };
  const provisional = connectionSnapshot(initial, "");
  publishNetxConnection(provisional);
  installPresetPublication(ctx);
  ctx.logger.info("netxops: provisional connection published → %s (token pending credentials)", provisional.apiUrl || "(invalid apiUrl)");
  const toolsApi = (() => {
    try {
      const fromGet = typeof ctx.get === "function" ? ctx.get("tools") : undefined;
      if (fromGet && typeof fromGet.register === "function") {
        return fromGet;
      }
    } catch {}
    const direct = ctx.tools;
    return direct && typeof direct.register === "function" ? direct : undefined;
  })();
  if (!toolsApi) {
    ctx.logger.warn("netxops: tools missing on apply — host tool mount skipped (loader should inject tools)");
    publishToolMountStatus({
      version: "unknown",
      plane: "host",
      groups: [],
      names: [],
      count: 0,
      at: new Date().toISOString(),
      error: "tools service missing on host apply",
      source: "host"
    });
  } else {
    let disposeToolsMount;
    let disposeKbLocal;
    const remountHostTools = () => {
      if (disposed)
        return;
      disposeToolsMount?.();
      disposeToolsMount = undefined;
      const connection = getNetxConnection();
      if (!connection)
        return;
      const enabled = connection.toolsEnabled === false ? [] : groupsForPlane(connection.groups, "host");
      disposeToolsMount = ctx.effect(() => {
        try {
          const unregister = registerNetxTools(ctx, connection, { plane: "host" });
          ctx.logger.info("netxops: host tools groups=[%s] count=%s", enabled.join(",") || "(none)", getToolMountStatus()?.count ?? 0);
          return () => {
            unregister();
          };
        } catch (error) {
          publishToolMountStatus({
            version: packageVersion3(),
            plane: "host",
            groups: [...enabled],
            names: [],
            count: 0,
            at: new Date().toISOString(),
            error: String(error)
          });
          ctx.logger.error("netxops: host tools register failed: %s", error);
          return () => {};
        }
      }, "netxops: host tools mount");
    };
    const remountKbLocal = () => {
      if (disposed)
        return;
      disposeKbLocal?.();
      disposeKbLocal = undefined;
      const connection = getNetxConnection();
      if (!connection)
        return;
      if (!kbEnabledForPlane(connection, "host"))
        return;
      disposeKbLocal = ctx.effect(() => {
        const unregister = registerKbLocalTools(ctx, getKbContext(), { plane: "host", source: "netxops-host:kb-local" });
        return () => {
          unregister?.();
        };
      }, "netxops: host kb-local tools");
    };
    const stopWatch = watchNetxConnection(() => {
      remountHostTools();
      remountKbLocal();
    });
    const stopCatalogWatch = watchMcpCatalog(() => {
      remountHostTools();
    });
    const stopKbWatch = watchKbContext(() => {
      remountKbLocal();
    });
    remountHostTools();
    remountKbLocal();
    ctx.effect(() => () => {
      stopWatch();
      stopCatalogWatch();
      stopKbWatch();
      disposeToolsMount?.();
      disposeKbLocal?.();
      resetToolMountStatus();
    }, "netxops: dispose host tools");
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
    const lang = resolveLang(current.lang);
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
        await dispatchAlarmToSinks(ctx, payload, {
          deliverDsh,
          deliverIm,
          imTargets,
          lang
        });
      }
    });
  };
  const publish2 = () => {
    if (disposed)
      return;
    const gen = ++generation;
    const currentSync = source();
    const previous = getNetxConnection();
    const sameCredential = resolveTokenCredentialRef(currentSync.tokenCredentialRef) === resolvedTokenRef;
    const sameHost = resolveApiUrlForConnection(currentSync.apiUrl).url === previous?.apiUrl;
    const prevToken = sameCredential && sameHost ? previous?.token ?? "" : "";
    publishNetxConnection(connectionSnapshot(currentSync, prevToken));
    const kb = resolveKbRoot(currentSync.kbRoot ?? "");
    publishKbContext(kb);
    applyKbEnv(kb);
    if (!currentSync.alarmPushEnabled) {
      stopAlarmPush?.();
      stopAlarmPush = undefined;
      resetAlarmPushStatus();
    }
    (async () => {
      const current = source();
      const tokenRef = resolveTokenCredentialRef(current.tokenCredentialRef);
      const token = await resolveToken(credentialsCtx, tokenRef, ctx.logger);
      if (disposed || gen !== generation)
        return;
      resolvedTokenRef = tokenRef;
      if (current.nmsProvider && current.nmsProvider !== "zte-ume") {
        ctx.logger.warn("netxops: nmsProvider=%s is not implemented yet; using zte-ume REST adapter", current.nmsProvider);
      }
      const snapshot = connectionSnapshot(current, token);
      publishNetxConnection(snapshot);
      const kb2 = resolveKbRoot(current.kbRoot ?? "");
      publishKbContext(kb2);
      applyKbEnv(kb2);
      if (kb2.status === "configured") {
        ctx.logger.info("netxops: knowledge base configured → %s (%s / %s v%s)", kb2.realRoot, kb2.operatorName, kb2.country, kb2.version);
      } else if (kb2.status === "error") {
        ctx.logger.warn("netxops: knowledge base error — %s", kb2.errorMessage);
      }
      restartAlarmPush(current, snapshot.apiUrl, token);
      const tokenConfigured = token.trim().length > 0;
      const catalog = await refreshMcpCatalog({
        apiUrl: snapshot.apiUrl,
        token,
        lang: snapshot.lang,
        timeoutMs: Math.min(snapshot.toolCallTimeoutMs, 45000)
      });
      if (disposed || gen !== generation)
        return;
      if (catalog.phase === "connected") {
        ctx.logger.info("netxops: mcp catalog ok → %s tools=%s", catalog.mcpUrl, catalog.tools.length);
      } else if (catalog.error) {
        ctx.logger.warn("netxops: mcp catalog %s → %s (%s)", catalog.phase, catalog.mcpUrl || "(no url)", catalog.error);
      }
      if (!tokenConfigured) {
        ctx.logger.warn("netxops: published connection → %s tokenConfigured=false (set credential %s)", snapshot.apiUrl, tokenRef);
      } else {
        const imSinkCount = resolveImTargets({
          imTargets: current.imTargets ?? "",
          imBotId: current.imBotId ?? "",
          imTargetId: current.imTargetId ?? ""
        }).length;
        ctx.logger.info("netxops: published connection → %s tokenConfigured=true alarmPush=%s dsh=%s im=%s host=[%s]", snapshot.apiUrl, current.alarmPushEnabled === true, current.alarmDeliverDsh !== false, imSinkCount, groupsForPlane(snapshot.groups, "host").join(",") || "(none)");
      }
    })().catch((error) => {
      ctx.logger.error("netxops: connection publish error: %s", error);
    });
  };
  publish2();
  ctx.on("loader/volatile-update", () => {
    publish2();
  });
  installNetxopsSettings(ctx, config, {
    setSource: (current) => {
      source = () => readConfigSnapshot(current());
    },
    onChange: () => {
      publish2();
    }
  });
  ctx.inject(["credentials"], (credCtx) => {
    credentialsCtx = credCtx;
    publish2();
    credCtx.on("credentials/reference-updated", (ref) => {
      if (String(ref) === resolveTokenCredentialRef(source().tokenCredentialRef))
        publish2();
    });
  });
  ctx.inject(["systemPrompt", "settings"], (promptCtx) => {
    const systemPrompt = promptCtx.systemPrompt;
    const liveConfig = () => {
      const settings = promptCtx.get("settings");
      const section = typeof settings?.get === "function" ? (() => {
        try {
          return settings.get(NETXOPS_SETTINGS_NAMESPACE);
        } catch {
          return;
        }
      })() : undefined;
      if (section !== null && typeof section === "object" && !Array.isArray(section)) {
        return mergeConfigSkippingNullish(source(), section);
      }
      return source();
    };
    const effectiveThinking = () => {
      const settings = promptCtx.get("settings");
      const current = liveConfig();
      return resolveThinkingLanguage(normalizeThinkingLanguage(current.thinkingLanguage), readSystemLocalePreference(settings));
    };
    const replySetting = () => normalizeReplyLanguage(liveConfig().replyLanguage);
    promptCtx.effect(() => {
      const disposers = [];
      const push = (dispose) => {
        if (typeof dispose === "function")
          disposers.push(dispose);
      };
      push(systemPrompt.section({
        name: "netxops:thinking-language",
        order: 85,
        text: () => thinkingInstruction(effectiveThinking())
      }));
      push(systemPrompt.context({
        name: "netxops:thinking-language-reminder",
        order: 1000,
        text: () => thinkingReminder(effectiveThinking())
      }));
      push(systemPrompt.section({
        name: "netxops:reply-language",
        order: 10150,
        text: () => replyInstruction(replySetting())
      }));
      push(systemPrompt.context({
        name: "netxops:reply-language-reminder",
        order: 1100,
        text: () => replyReminder(replySetting())
      }));
      promptCtx.logger.info("netxops: model language prompts registered (thinking=%s reply=%s)", normalizeThinkingLanguage(liveConfig().thinkingLanguage), replySetting());
      return () => {
        for (const dispose of disposers.splice(0))
          dispose();
      };
    }, "netxops: model language prompts");
  });
  ctx.inject(["skills"], (skillsCtx) => {
    let skillAbort = new AbortController;
    let packAbort = new AbortController;
    let unregisterSkills;
    let unregisterKbSkill;
    let unregisterKbPack;
    let generation2 = 0;
    let packGeneration = 0;
    const remountHostSkills = () => {
      if (disposed)
        return;
      const gen = ++generation2;
      skillAbort.abort();
      skillAbort = new AbortController;
      unregisterSkills?.();
      unregisterSkills = undefined;
      const connection = getNetxConnection();
      if (!connection)
        return;
      const enabled = connection.toolsEnabled === false ? [] : groupsForPlane(connection.groups, "host");
      const disabledByGroup = Object.fromEntries(enabled.map((groupId) => [
        groupId,
        disabledPublicNames(getMcpCatalogTools(), [groupId], connection.disabledTools, connection.readOnlyOnly)
      ]));
      registerGroupSkills(skillsCtx, enabled, "netxops-host", {
        signal: skillAbort.signal,
        disabledByGroup,
        lang: connection.lang
      }).then((dispose) => {
        if (gen !== generation2) {
          dispose();
          return;
        }
        unregisterSkills = dispose;
        skillsCtx.logger.info("netxops: host skills groups=[%s]", enabled.join(",") || "(none)");
      }).catch((error) => {
        skillsCtx.logger.warn("netxops: host skill register failed: %s", error);
      });
    };
    const remountKbSkill = () => {
      if (disposed)
        return;
      unregisterKbSkill?.();
      unregisterKbSkill = undefined;
      const connection = getNetxConnection();
      if (!kbEnabledForPlane(connection, "host"))
        return;
      const snapshot = getKbContext();
      unregisterKbSkill = registerKbContextSkill(skillsCtx, snapshot);
      skillsCtx.logger.info("netxops: kb-context skill status=%s (host/public)", snapshot.status);
    };
    const remountKbPack = () => {
      if (disposed)
        return;
      const gen = ++packGeneration;
      packAbort.abort();
      packAbort = new AbortController;
      unregisterKbPack?.();
      unregisterKbPack = undefined;
      const connection = getNetxConnection();
      const enabled = kbEnabledForPlane(connection, "host") && Boolean(connection);
      registerKbPackSkills(skillsCtx, getKbContext(), {
        enabled,
        providerLabel: "netxops-kb-pack-host",
        signal: packAbort.signal
      }).then((dispose) => {
        if (gen !== packGeneration) {
          dispose();
          return;
        }
        unregisterKbPack = dispose;
      }).catch((error) => {
        skillsCtx.logger.warn("netxops: host kb pack skill register failed: %s", error);
      });
    };
    const stopWatch = watchNetxConnection(() => {
      remountHostSkills();
      remountKbSkill();
      remountKbPack();
    });
    const stopCatalogWatch = watchMcpCatalog(() => {
      remountHostSkills();
    });
    const stopKbWatch = watchKbContext(() => {
      remountKbSkill();
      remountKbPack();
    });
    remountHostSkills();
    remountKbSkill();
    remountKbPack();
    skillsCtx.effect(() => () => {
      generation2 += 1;
      packGeneration += 1;
      skillAbort.abort();
      packAbort.abort();
      stopWatch();
      stopCatalogWatch();
      stopKbWatch();
      unregisterSkills?.();
      unregisterKbSkill?.();
      unregisterKbPack?.();
    }, "netxops: dispose host skills");
  });
  const handleNetxopsRpc = async (endpoint, payload) => {
    if (endpoint === "presets.catalog") {
      const registry = ctx.get("agentPresets");
      if (!registry?.list)
        return { ok: false, error: "preset_registry_unavailable" };
      const presets = await registry.list();
      return { ok: true, value: { presets: presets.map(({ id, name: name2, broken }) => ({ id, name: name2, broken })) } };
    }
    if (endpoint === "tools.status") {
      const mount = getToolMountStatus();
      const connection = getNetxConnection();
      const catalog = getMcpCatalogState();
      return {
        ok: true,
        value: {
          mount: mount ?? null,
          mounts: getToolMountStatuses(),
          mcp: {
            phase: catalog.phase,
            mcpUrl: catalog.mcpUrl,
            error: catalog.error,
            listedAt: catalog.listedAt,
            fromCache: catalog.fromCache,
            toolCount: catalog.tools.length
          },
          connection: connection ? {
            apiUrl: connection.apiUrl,
            toolsEnabled: connection.toolsEnabled !== false,
            tokenConfigured: connection.token.trim().length > 0,
            hostGroups: connection.toolsEnabled === false ? [] : groupsForPlane(connection.groups, "host"),
            presetGroups: connection.toolsEnabled === false ? [] : groupsForPlane(connection.groups, "preset"),
            publicGroups: connection.toolsEnabled === false ? [] : groupsForPlane(connection.groups, "public"),
            disabledTools: [...connection.disabledTools ?? []],
            readOnlyOnly: connection.readOnlyOnly === true
          } : null
        }
      };
    }
    if (endpoint === "tools.catalog") {
      return { ok: true, value: mcpCatalogPayload(getMcpCatalogState()) };
    }
    if (endpoint === "tools.refresh") {
      const connection = getNetxConnection();
      if (!connection)
        return { ok: false, error: "connection_unavailable" };
      const catalog = await refreshMcpCatalog({
        apiUrl: connection.apiUrl,
        token: connection.token,
        lang: connection.lang,
        timeoutMs: Math.min(connection.toolCallTimeoutMs, 45000)
      });
      return {
        ok: catalog.phase === "connected",
        value: { ...mcpCatalogPayload(catalog), toolCount: catalog.tools.length },
        ...catalog.error ? { error: catalog.error } : {}
      };
    }
    if (endpoint === "alarm-push.status") {
      return { ok: true, value: getAlarmPushStatus() };
    }
    if (endpoint === "kb.status") {
      return { ok: true, value: getKbContext() };
    }
    if (endpoint === "kb.reload") {
      const current = source();
      const kb = resolveKbRoot(current.kbRoot ?? "");
      publishKbContext(kb, { force: true });
      applyKbEnv(kb);
      if (kb.status === "configured") {
        ctx.logger.info("netxops: kb.reload → %s (%s / %s v%s)", kb.realRoot, kb.operatorName, kb.country, kb.version);
      } else if (kb.status === "error") {
        ctx.logger.warn("netxops: kb.reload error — %s", kb.errorMessage);
      } else {
        ctx.logger.info("netxops: kb.reload → unconfigured (kbRoot empty)");
      }
      return { ok: true, value: kb };
    }
    if (endpoint === "kb.resolve") {
      const path = extractKbResolvePath(payload);
      return { ok: true, value: resolveKbRoot(path) };
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
            reasonCode: "im_catalog_unavailable",
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
  };
  ctx.inject(["webServer", "connection"], (mountCtx) => {
    mountCtx.effect(() => {
      const direct = mountNetxopsWebRoute(mountCtx, NETXOPS_RPC_CHANNEL, (endpoint, payload) => handleNetxopsRpc(endpoint, payload));
      if (direct !== null) {
        mountCtx.logger.info("netxops: /netxops rpc mounted on webServer");
        return direct;
      }
      const rpc = mountCtx.get("connection")?.rpc;
      if (rpc && typeof rpc.handle === "function") {
        mountCtx.logger.info("netxops: /netxops rpc mounted via connection.rpc.handle (legacy)");
        const legacy = rpc.handle(NETXOPS_RPC_CHANNEL, (endpoint, payload) => handleNetxopsRpc(endpoint, payload));
        return () => {
          if (typeof legacy === "function")
            legacy();
        };
      }
      mountCtx.logger.warn("netxops: /netxops rpc unavailable — settings card status disabled");
      return () => {};
    }, "netxops: /netxops web rpc");
  });
  ctx.inject(["connection"], (connCtx) => {
    const connection = connCtx.get("connection");
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
    disposed = true;
    generation += 1;
    publishNetxConnection({ ...provisional, token: "", toolsEnabled: false });
    stopAlarmPush?.();
    stopAlarmPush = undefined;
    resetAlarmSession();
    resetAlarmPushStatus();
    resetKbContext();
  }, "netxops: dispose host bridge");
}
function extractKbResolvePath(payload) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload))
    return "";
  const row = payload;
  if (typeof row.path === "string")
    return row.path;
  const args = row.args;
  if (args !== null && typeof args === "object" && !Array.isArray(args)) {
    const path = args.path;
    if (typeof path === "string")
      return path;
  }
  return "";
}
export {
  writePatchIfUnchanged,
  syncDeclarativeIntoProfilePatch,
  resolveToolCallTimeoutMs,
  resolveTokenCredentialRef,
  resolveLang,
  resolveApiUrlForConnection,
  normalizeApiUrl,
  name,
  mergeHostConfigForHeal,
  mergeConfigSkippingNullish,
  installDirectoryPreset,
  inject,
  ensureAgentPresetInstalled,
  composeNetxopsPresetArtifacts,
  apply,
  NETXOPS_SETTINGS_NAMESPACE,
  NETXOPS_RPC_CHANNEL,
  NETXOPS_PRESET_ID,
  NETXOPS_HOST_CONFIG_DEFAULTS,
  DEFAULT_TOOL_CALL_TIMEOUT_MS,
  DEFAULT_TOKEN_REF,
  DEFAULT_LANG,
  DEFAULT_API_URL,
  Config
};
