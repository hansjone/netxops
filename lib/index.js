import { createRequire } from "node:module";
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// src/index.ts
import { readFileSync as readFileSync9 } from "node:fs";
import { dirname as dirname8, join as join13 } from "node:path";
import { fileURLToPath as fileURLToPath5 } from "node:url";
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
  groupKbPublic: false
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
var PROTOCOL_KEY_ZH_TO_EN = {
  其他: "Other",
  时钟: "Clock",
  "OTN/光": "OTN/Optical",
  电源: "Power"
};
function asLang(value) {
  return typeof value === "string" ? value : "";
}
function localizePayload(lang, data) {
  if (!asLang(lang).trim().toLowerCase().startsWith("en"))
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
  const langParams = () => {
    const lang = asLang(connection.lang).trim().toLowerCase();
    if (lang.startsWith("en"))
      return { lang: "en" };
    return {};
  };
  async function request(method, path, options = {}) {
    const rawUrl = typeof connection.getApiUrl === "function" ? connection.getApiUrl() : connection.apiUrl;
    const normalized = normalizeApiUrl(typeof rawUrl === "string" ? rawUrl : "");
    const base = normalized.ok ? normalized.url : "";
    if (!normalized.ok || !base) {
      return {
        ok: false,
        error: "netx_api_url_invalid",
        detail: `apiUrl must be http(s) without embedded credentials (${normalized.ok ? "empty" : normalized.error}).`
      };
    }
    const rawToken = connection.getToken();
    const token = typeof rawToken === "string" ? rawToken.trim() : "";
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
    "netx__getNeExecJob",
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
    "netx__analyzeTopologyViewLayout"
  ]),
  bizMonitor: Object.freeze([
    "netx__listBizMonitors",
    "netx__listBizMonitorBatches",
    "netx__getBizMonitorContext",
    "netx__getBizMonitorBoard",
    "netx__listBizMonitorReds",
    "netx__getBizMonitorDiffs",
    "netx__getBizCollectBatch",
    "netx__getBizCollectCommandRaw"
  ])
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
function toolNamesForGroups(groupIds) {
  const out = new Set;
  for (const id of groupIds) {
    for (const name of TOOLS_BY_GROUP[id] ?? [])
      out.add(name);
  }
  return out;
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
import { existsSync as existsSync3 } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname as dirname2, join as join3 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
function opsSkillsRoot() {
  const envRoot = process.env.NETX_SKILLS_ROOT?.trim();
  if (envRoot && existsSync3(envRoot))
    return envRoot;
  const here = dirname2(fileURLToPath2(import.meta.url));
  const checkout = [join3(here, "..", ".git"), join3(here, "..", "..", ".git")].some(existsSync3);
  const siblingCandidates = [
    join3(here, "..", "..", "..", "netx", "skills"),
    join3(here, "..", "..", "netx", "skills")
  ];
  for (const candidate of checkout ? siblingCandidates : []) {
    if (existsSync3(candidate))
      return candidate;
  }
  const packaged = [
    join3(here, "..", "presets", "netxops", "skills"),
    join3(here, "..", "..", "presets", "netxops", "skills")
  ];
  for (const candidate of packaged) {
    if (existsSync3(candidate))
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
  const skillPath = join3(dir, "SKILL.md");
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
  const groupDir = join3(skillsRoot, SKILL_DIR_BY_GROUP[groupId]);
  let entries;
  try {
    entries = await readdir(groupDir);
  } catch {
    return { skills: [], skipped: [{ directory: groupDir, reason: "missing group dir" }] };
  }
  const skills = [];
  const skipped = [];
  for (const entry of entries) {
    const full = join3(groupDir, entry);
    let isDir = false;
    try {
      isDir = (await stat(full)).isDirectory();
    } catch {
      continue;
    }
    if (!isDir)
      continue;
    const skillPath = join3(full, "SKILL.md");
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
async function registerGroupSkills(ctx, groupIds, providerLabel, signal) {
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
        log?.warn?.("%s: no skills loaded for group=%s from %s", providerLabel, groupId, join3(root, SKILL_DIR_BY_GROUP[groupId]));
      }
      for (const skill of skills) {
        disposers.push(skillsApi.register({
          name: skill.name,
          description: skill.description,
          content: groupId === "topology" ? `${skill.content}

## DeepSeek Harness REST capabilities
Use only tools present in this session. Native layout supports catalog and move_nodes/sink_nodes. Dual-unit/orbit/polish recipes require a separately installed netx-topology MCP. Native analyzeTopologyViewLayout reports basic graph statistics; suggestSinkHubs uses degree ranking. Native sinkTopologyDualUnits is unavailable.
` : skill.content,
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
import { readdirSync as readdirSync2, readFileSync as readFileSync4, statSync as statSync4 } from "node:fs";
import { join as join6 } from "node:path";

// src/netx/kb-manifest.ts
import { existsSync as existsSync4, readdirSync, readFileSync as readFileSync3, statSync as statSync2 } from "node:fs";
import { basename, dirname as dirname3, join as join4, resolve } from "node:path";
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
    rootStat = statSync2(root);
  } catch {
    return { paths: [], error: `kbRoot not found: ${root}` };
  }
  if (!rootStat.isDirectory()) {
    return { paths: [], error: `kbRoot is not a directory: ${root}` };
  }
  const direct = join4(root, "MANIFEST.json");
  if (existsSync4(direct)) {
    try {
      if (statSync2(direct).isFile())
        return { paths: [direct] };
    } catch {}
  }
  const found = [];
  const walk = (dir, depth) => {
    if (depth > maxDepth)
      return;
    const candidate = join4(dir, "MANIFEST.json");
    if (existsSync4(candidate)) {
      try {
        if (statSync2(candidate).isFile())
          found.push(candidate);
      } catch {}
    }
    if (depth === maxDepth)
      return;
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (name === "node_modules" || name === ".git")
        continue;
      const full = join4(dir, name);
      let st;
      try {
        st = statSync2(full);
      } catch {
        continue;
      }
      if (st.isDirectory())
        walk(full, depth + 1);
    }
  };
  let topEntries;
  try {
    topEntries = readdirSync(root);
  } catch {
    return { paths: [], error: `cannot read kbRoot: ${root}` };
  }
  for (const name of topEntries) {
    if (name === "node_modules" || name === ".git")
      continue;
    const full = join4(root, name);
    let st;
    try {
      st = statSync2(full);
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
    const st = statSync2(root);
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
    raw = readFileSync3(manifestPath, "utf8");
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
import { existsSync as existsSync5, realpathSync, statSync as statSync3 } from "node:fs";
import { join as join5, relative, resolve as resolve2, sep } from "node:path";
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
      if (!statSync3(realFile).isFile()) {
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
  return join5("memories", MEMORY_BUCKET_DIR[bucket]);
}
function suggestionDir(kind) {
  return join5("suggestions", kind);
}
function draftDir(domain) {
  const d = domain?.trim();
  if (!d)
    return "drafts";
  return join5("drafts", sanitizeSlug(d, "misc"));
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
    return join5("refs", "devices", host);
  }
  return join5("refs", area);
}

// src/netx/kb-context-skill.ts
var SKILL_NAME = "kb-context";
var IDENTITY_FILE_MAX = 8000;
var IDENTITY_TOTAL_MAX = 24000;
function readKbIdentity(snapshot) {
  const localRoot = resolveKbLocalRoot(snapshot);
  if (!localRoot)
    return [];
  const dir = join6(localRoot, "identity");
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
    const full = join6(dir, name);
    let text;
    try {
      if (!statSync4(full).isFile())
        continue;
      text = readFileSync4(full, "utf8").replace(/^\uFEFF/, "").trim();
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
  mkdirSync as mkdirSync2,
  readdirSync as readdirSync3,
  readFileSync as readFileSync5,
  rmSync,
  statSync as statSync5,
  writeFileSync as writeFileSync3
} from "node:fs";
import { dirname as dirname4, join as join7 } from "node:path";
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
  mkdirSync2(dirname4(target.absolutePath), { recursive: true });
  const existed = existsSync6(target.absolutePath);
  writeFileSync3(target.absolutePath, args.body.endsWith(`
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
  mkdirSync2(dirname4(target.absolutePath), { recursive: true });
  const existed = existsSync6(target.absolutePath);
  writeFileSync3(target.absolutePath, ensureDraftBody(args.body), "utf8");
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
  mkdirSync2(dirname4(target.absolutePath), { recursive: true });
  const existed = existsSync6(target.absolutePath);
  writeFileSync3(target.absolutePath, args.body.endsWith(`
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
  mkdirSync2(dirname4(target.absolutePath), { recursive: true });
  const existed = existsSync6(target.absolutePath);
  writeFileSync3(target.absolutePath, args.body.endsWith(`
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
  writeFileSync3(target.absolutePath, body, "utf8");
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
    const full = join7(dir, name);
    let st;
    try {
      st = statSync5(full);
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
    walkFiles(join7(localRoot, r), localRoot, entries);
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
import { readdirSync as readdirSync4, readFileSync as readFileSync6, realpathSync as realpathSync2, statSync as statSync6 } from "node:fs";
import { extname, join as join8, relative as relative2, resolve as resolve3, sep as sep2 } from "node:path";
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
  const st = statSync6(target.absolutePath);
  if (st.isDirectory()) {
    const entries = readdirSync4(target.absolutePath, { withFileTypes: true }).filter((entry) => !SKIP_DIRS.has(entry.name)).map((entry) => {
      if (entry.isDirectory())
        return { name: entry.name, type: "dir" };
      let size;
      try {
        size = statSync6(join8(target.absolutePath, entry.name)).size;
      } catch {}
      return { name: entry.name, type: "file", size };
    }).sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1);
    return { ok: true, kind: "directory", ...target, entries };
  }
  if (!TEXT_EXTENSIONS.has(extname(target.absolutePath).toLowerCase())) {
    throw new Error(`not a text KB file: ${target.relativePath}`);
  }
  const lines = readFileSync6(target.absolutePath, "utf8").replace(/^\uFEFF/, "").replace(/\r\n?/g, `
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
  const text = readFileSync6(path, "utf8").replace(/^\uFEFF/, "");
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
    const full = join8(dir, entry.name);
    if (entry.isDirectory()) {
      walkTextFiles(full, out);
      continue;
    }
    if (!entry.isFile() || !TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase()))
      continue;
    try {
      const st = statSync6(full);
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
    const st = statSync6(dir);
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
function publishKbContext(next, options = {}) {
  const state = store2();
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
  const state = store2();
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
function omitUndefined(record) {
  const out = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined)
      out[key] = value;
  }
  return out;
}

// src/netx/tool-mount-status.ts
import { mkdirSync as mkdirSync3, writeFileSync as writeFileSync4 } from "node:fs";
import { homedir as homedir3 } from "node:os";
import { dirname as dirname5, join as join9 } from "node:path";
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
    const path = join9(process.env.DSH_HOME?.trim() || join9(homedir3(), ".dsh"), "netxops-mount-status.json");
    mkdirSync3(dirname5(path), { recursive: true });
    writeFileSync4(path, `${JSON.stringify({ mount: getToolMountStatus() ?? null, mounts: getToolMountStatuses() }, null, 2)}
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
function resetToolMountStatus() {
  store3().mounts.clear();
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
import { join as join10 } from "node:path";
function kbPackSkillsEnabled(snapshot) {
  return snapshot.status === "configured" && snapshot.content.hasSkills === true;
}
function resolveKbSkillsRoot(snapshot) {
  const rel = snapshot.paths.skills?.trim() || "_skills";
  return join10(snapshot.realRoot, rel);
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
  return join10(snapshot.realRoot, rel);
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
      const full = join10(root, entry);
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
function publishNetxConnection(next) {
  const state = store4();
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

// src/netx/session-export.ts
import { homedir as homedir4, hostname as osHostname } from "node:os";

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
import { readFileSync as readFileSync7 } from "node:fs";
import { dirname as dirname6, join as join11 } from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";
import { defineTool as defineTool2 } from "@deepseek-ai/dsh-tools";

// src/netx/handlers.ts
var EXEC_MAX_COMMANDS_CAP = 50;
var EXEC_MAX_COMMANDS_DEFAULT = 5;
function execMaxCommands() {
  const raw = Number.parseInt(String(process.env.NETX_NE_EXEC_MAX_COMMANDS ?? ""), 10);
  const n = Number.isFinite(raw) ? raw : EXEC_MAX_COMMANDS_DEFAULT;
  return Math.max(1, Math.min(EXEC_MAX_COMMANDS_CAP, n));
}
function asyncMinNes() {
  const raw = Number.parseInt(String(process.env.NETX_NE_EXEC_ASYNC_MIN_NES ?? ""), 10);
  const n = Number.isFinite(raw) ? raw : 4;
  return Math.max(0, Math.min(50, n));
}
function truthyAsyncFlag(raw) {
  if (raw === undefined || raw === null)
    return;
  if (typeof raw === "boolean")
    return raw;
  const text = String(raw).trim().toLowerCase();
  if (!text)
    return;
  if (["1", "true", "yes", "on"].includes(text))
    return true;
  if (["0", "false", "no", "off"].includes(text))
    return false;
  return;
}
function countExecNeTargets(args) {
  let n = 0;
  for (const key of ["ne_ids", "nms_ne_ids", "ume_ne_ids"]) {
    const val = strList(args, key);
    if (val.length > 0)
      n = Math.max(n, val.length);
  }
  const targets = args.targets;
  if (Array.isArray(targets)) {
    n = Math.max(n, targets.filter((t) => typeof t === "object" && t !== null && !Array.isArray(t)).length);
  }
  if (n === 0) {
    if (str2(args, "ne_id").trim() || nmsOrUme(args, "nms_ne_id", "ume_ne_id"))
      return 1;
  }
  return n;
}
function shouldRunExecAsync(args) {
  const flag = truthyAsyncFlag(args.async);
  if (flag === false)
    return false;
  if (flag === true)
    return true;
  const minN = asyncMinNes();
  if (minN <= 0)
    return false;
  return countExecNeTargets(args) >= minN;
}
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
function str2(args, key, fallback = "") {
  const v = args[key];
  if (typeof v === "string")
    return v;
  if (typeof v === "number" || typeof v === "boolean")
    return String(v);
  return fallback;
}
function nmsOrUme(args, nmsKey, umeKey) {
  return str2(args, nmsKey).trim() || str2(args, umeKey).trim();
}
function nmsOrUmeList(args, nmsKey, umeKey) {
  const primary = strList(args, nmsKey);
  return primary.length > 0 ? primary : strList(args, umeKey);
}
function num2(args, key) {
  const v = args[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function bool2(args, key) {
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
    const v = str2(args, key).trim();
    if (v)
      params[key] = v;
  }
}
async function queryUmeAlarms(client, args, signal) {
  let page = clampInt(num2(args, "page"), 1, 1, 2);
  const pageSize = clampInt(num2(args, "page_size"), 50, 1, 500);
  const params = { page, page_size: pageSize };
  putStr(params, args, ["severity", "ne_id", "host_name", "time_from", "time_to"]);
  const keyword = str2(args, "keyword").trim();
  const neName = str2(args, "ne_name").trim();
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
    const flag = bool2(args, "exclude_missing_host");
    if (flag !== undefined)
      params.exclude_missing_host = flag;
  }
  return client.get("/v1/ume/alarms/aggregate/raw", params, signal);
}
async function aggregateUmeAlarms(client, args, signal) {
  if (str2(args, "group_by").trim())
    return aggregateUmeAlarmsRaw(client, args, signal);
  const topNe = clampInt(num2(args, "top_ne"), 50, 0, 500);
  const params = { top_ne: topNe };
  if ("exclude_missing_host" in args) {
    const flag = bool2(args, "exclude_missing_host");
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
    page: clampInt(num2(args, "page"), 1, 1, Number.MAX_SAFE_INTEGER),
    page_size: clampInt(num2(args, "page_size"), 50, 1, 500)
  };
  putStr(params, args, ["keyword"]);
  return client.get("/v1/ume/inventory/ne", params, signal);
}
async function getUmeNe(client, args, signal) {
  const neId = str2(args, "ne_id").trim();
  if (!neId)
    return { ok: false, error: "ne_id_required", error_code: "ne_id_required" };
  return client.get(`/v1/ume/inventory/ne/${quoteNeId(neId)}`, undefined, signal);
}
async function queryUmeAlarmsRaw(client, args, signal) {
  const params = {
    page: clampInt(num2(args, "page"), 1, 1, Number.MAX_SAFE_INTEGER),
    page_size: clampInt(num2(args, "page_size"), 50, 1, 500)
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
    const preset = str2(args, "field_preset").trim().toLowerCase();
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
  const sql = str2(args, "sql").trim();
  if (!sql)
    return { ok: false, error: "sql_required" };
  const limit = clampInt(num2(args, "limit"), 200, 1, 2000);
  const statementTimeoutMs = clampInt(num2(args, "statement_timeout_ms"), 0, 0, 30000);
  return client.post("/v1/sql/ume_query", {
    sql,
    limit,
    statement_timeout_ms: statementTimeoutMs
  }, signal, 60000);
}
async function listManagedNe(client, args, signal) {
  const keyword = str2(args, "keyword").trim();
  const vendor = str2(args, "vendor").trim();
  const connectStatus = str2(args, "connect_status").trim();
  if (!(keyword || vendor || connectStatus)) {
    return { ok: false, error: "managed_ne_filter_required", error_code: "managed_ne_filter_required" };
  }
  if (keyword && keyword.length < 2) {
    return { ok: false, error: "managed_ne_keyword_too_short", error_code: "managed_ne_keyword_too_short" };
  }
  const params = {
    page: clampInt(num2(args, "page"), 1, 1, Number.MAX_SAFE_INTEGER),
    page_size: clampInt(num2(args, "page_size"), 20, 1, 100)
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
  const neId = (str2(args, "ne_id") || str2(args, "managed_ne_id") || str2(args, "id")).trim();
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
    const detail = `${str2(out, "detail")}${str2(out, "error")}`.toLowerCase();
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
  const maxCmds = execMaxCommands();
  const wantAsync = shouldRunExecAsync(args);
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
        const neId2 = str2(row, "ne_id").trim();
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
      if (sharedCommands.length > maxCmds) {
        return { ok: false, error: "too_many_commands", error_code: "too_many_commands" };
      }
      body2.commands = sharedCommands;
    }
    body2.read_timeout_sec = clampInt(num2(args, "read_timeout_sec"), 60, 10, 120);
    const concurrency = num2(args, "concurrency");
    if (concurrency !== undefined)
      body2.concurrency = clampInt(concurrency, 4, 1, 8);
    if (wantAsync) {
      const out3 = await client.post("/v1/managed-ne/exec-jobs", body2, signal, 60000);
      if (out3.ok !== true)
        return out3;
      const data3 = asRecord(out3.data);
      return Object.keys(data3).length > 0 ? data3 : out3;
    }
    const out2 = await client.post("/v1/managed-ne/exec-batch", body2, signal, 600000);
    if (out2.ok !== true)
      return out2;
    const data2 = asRecord(out2.data);
    if (data2.ok === false) {
      return { ok: false, data: data2, error: str2(data2, "error", "exec_batch_failed") };
    }
    return { ok: true, data: data2 };
  }
  const neId = str2(args, "ne_id").trim();
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
  if (sharedCommands.length > maxCmds) {
    return { ok: false, error: "too_many_commands", error_code: "too_many_commands" };
  }
  const body = {
    commands: sharedCommands,
    read_timeout_sec: clampInt(num2(args, "read_timeout_sec"), 60, 10, 120)
  };
  if (neId)
    body.ne_id = neId;
  if (umeNeId)
    body.ume_ne_id = umeNeId;
  if (wantAsync) {
    const out2 = await client.post("/v1/managed-ne/exec-jobs", body, signal, 60000);
    if (out2.ok !== true)
      return out2;
    const data2 = asRecord(out2.data);
    return Object.keys(data2).length > 0 ? data2 : out2;
  }
  const out = await client.post("/v1/managed-ne/exec", body, signal, 300000);
  if (out.ok !== true)
    return out;
  const data = asRecord(out.data);
  if (data.ok === false) {
    return { ok: false, data, error: str2(data, "error", "exec_failed") };
  }
  return { ok: true, data };
}
async function getNeExecJob(client, args, signal) {
  const jobId = str2(args, "job_id").trim();
  if (!jobId) {
    return {
      ok: false,
      error: "job_id_required",
      error_code: "job_id_required",
      hint: "Pass job_id from execManagedNe async ack."
    };
  }
  return client.get(`/v1/managed-ne/exec-jobs/${quoteNeId(jobId)}`, undefined, signal);
}
async function listCliTargets(client, args, signal) {
  const params = {
    page: clampInt(num2(args, "page"), 1, 1, Number.MAX_SAFE_INTEGER),
    page_size: clampInt(num2(args, "page_size"), 50, 1, 500)
  };
  putStr(params, args, ["source", "keyword"]);
  return client.get("/v1/cli/targets", params, signal);
}
async function findTopologyPaths(client, args, signal) {
  const fromUid = nmsOrUme(args, "from_nms_ne_id", "from_ume_ne_id");
  const fromMid = str2(args, "from_managed_ne_id").trim();
  const toUid = nmsOrUme(args, "to_nms_ne_id", "to_ume_ne_id");
  const toMid = str2(args, "to_managed_ne_id").trim();
  if (Boolean(fromUid) === Boolean(fromMid)) {
    return { ok: false, error: "exactly_one_of_from_nms_ne_id_or_from_managed_ne_id_required" };
  }
  if (Boolean(toUid) === Boolean(toMid)) {
    return { ok: false, error: "exactly_one_of_to_nms_ne_id_or_to_managed_ne_id_required" };
  }
  let detail = str2(args, "detail", "summary").trim().toLowerCase() || "summary";
  if (detail !== "summary" && detail !== "full")
    detail = "summary";
  const body = {
    max_paths: clampInt(num2(args, "max_paths"), 3, 1, 10),
    max_hops: clampInt(num2(args, "max_hops"), 6, 1, 12),
    layer: str2(args, "layer", "physical").trim() || "physical",
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
function taskBriefNe(brief) {
  const rec = asRecord(brief);
  const name = typeof rec.ne_name === "string" ? rec.ne_name.trim() : "";
  const ip = typeof rec.ne_ip === "string" ? rec.ne_ip.trim() : "";
  if (name && ip)
    return `${name} (${ip})`;
  return name || ip;
}
function slimMigrationProject(row) {
  const mt = asRecord(row.monitor_template);
  return omitUndefined({
    id: row.id,
    name: row.name,
    status: row.status,
    note: row.note,
    monitor_template_id: row.monitor_template_id,
    monitor_template_name: typeof mt.name === "string" ? mt.name : "",
    old_task_id: row.old_task_id,
    new_task_id: row.new_task_id,
    old_hf_task_id: row.old_hf_task_id,
    new_hf_task_id: row.new_hf_task_id,
    old_ne: taskBriefNe(row.old_task),
    new_ne: taskBriefNe(row.new_task),
    hf_interval_sec: row.hf_interval_sec,
    hf_start_at: row.hf_start_at,
    hf_end_at: row.hf_end_at,
    updated_at: row.updated_at
  });
}
function matchesBizMonitorQ(row, q) {
  if (!q)
    return true;
  const hay = [
    row.id,
    row.name,
    row.note,
    row.status,
    row.ne_name,
    row.ne_ip,
    row.ne_id,
    row.old_ne,
    row.new_ne,
    row.monitor_template_name,
    row.purpose,
    row.vendor
  ].map((v) => typeof v === "string" || typeof v === "number" ? String(v).toLowerCase() : "").join(" ");
  return hay.includes(q);
}
async function listBizMonitors(client, args, signal) {
  const kindRaw = str2(args, "kind", "all").trim().toLowerCase() || "all";
  const kind = kindRaw === "project" ? "projects" : kindRaw === "task" ? "tasks" : kindRaw;
  if (kind !== "all" && kind !== "projects" && kind !== "tasks") {
    return { ok: false, error: "kind_invalid", detail: "kind must be all|projects|tasks" };
  }
  const purpose = str2(args, "purpose").trim();
  const status = str2(args, "status").trim().toLowerCase();
  const q = str2(args, "q").trim().toLowerCase();
  const limit = clampInt(num2(args, "limit") ?? 100, 100, 1, 500);
  const wantProjects = kind === "all" || kind === "projects";
  const wantTasks = kind === "all" || kind === "tasks";
  const fetches = [];
  if (wantProjects)
    fetches.push(client.get("/v1/biz-migration/projects", {}, signal));
  else
    fetches.push(Promise.resolve({ ok: true, data: { items: [] } }));
  if (wantTasks) {
    const params = {};
    if (purpose)
      params.purpose = purpose;
    fetches.push(client.get("/v1/biz-state/tasks", params, signal));
  } else {
    fetches.push(Promise.resolve({ ok: true, data: { items: [] } }));
  }
  const [projRes, taskRes] = await Promise.all(fetches);
  if (wantProjects && projRes.ok === false)
    return projRes;
  if (wantTasks && taskRes.ok === false)
    return taskRes;
  const projItems = Array.isArray(asRecord(projRes.data).items) ? asRecord(projRes.data).items : [];
  const taskItems = Array.isArray(asRecord(taskRes.data).items) ? asRecord(taskRes.data).items : [];
  let projects = projItems.map((row) => slimMigrationProject(asRecord(row))).filter((row) => {
    if (status && String(row.status || "").toLowerCase() !== status)
      return false;
    return matchesBizMonitorQ(row, q);
  });
  let tasks = taskItems.map((row) => asRecord(row)).filter((row) => {
    if (status && String(row.status || "").toLowerCase() !== status)
      return false;
    return matchesBizMonitorQ(row, q);
  });
  const projectsTotal = projects.length;
  const tasksTotal = tasks.length;
  projects = projects.slice(0, limit);
  tasks = tasks.slice(0, limit);
  return {
    ok: true,
    data: omitUndefined({
      kind,
      projects: wantProjects ? projects : undefined,
      tasks: wantTasks ? tasks : undefined,
      counts: {
        projects: wantProjects ? projectsTotal : 0,
        tasks: wantTasks ? tasksTotal : 0,
        projects_returned: wantProjects ? projects.length : 0,
        tasks_returned: wantTasks ? tasks.length : 0
      },
      next: "Pass project_id (or task_id) to netx__getBizMonitorContext; then listBizMonitorBatches for batch_id / run_id."
    })
  };
}
function slimCutoverBatch(row) {
  return omitUndefined({
    id: row.id,
    project_id: row.project_id,
    batch_label: row.batch_label,
    status: row.status,
    accept_status: row.accept_status,
    accept_run_id: row.accept_run_id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at
  });
}
function slimCollectBatch(row, taskId = "") {
  return omitUndefined({
    id: row.id,
    task_id: row.task_id || taskId || undefined,
    status: row.status,
    ne_name: row.ne_name,
    command_count: row.command_count,
    row_count: row.row_count,
    is_baseline: row.is_baseline,
    protected: row.protected,
    message: row.message,
    started_at: row.started_at,
    ended_at: row.ended_at
  });
}
function slimEvalRun(row) {
  const summary = asRecord(row.summary);
  const progress = asRecord(summary.progress);
  return omitUndefined({
    id: row.id,
    batch_id: row.batch_id,
    purpose: row.purpose,
    old_batch_id: row.old_batch_id,
    new_batch_id: row.new_batch_id,
    created_at: row.created_at,
    anomaly: summary.anomaly,
    progress_ok: progress.ok ?? summary.progress_ok,
    progress_total: progress.total ?? summary.progress_total
  });
}
async function listBizMonitorBatches(client, args, signal) {
  const projectId = str2(args, "project_id").trim();
  const taskId = str2(args, "task_id").trim();
  const batchId = str2(args, "batch_id").trim();
  const kindRaw = str2(args, "kind", "auto").trim().toLowerCase() || "auto";
  const includeRuns = args.include_runs === true || args.include_runs === "true" || args.include_runs === 1;
  const status = str2(args, "status").trim().toLowerCase();
  const limit = clampInt(num2(args, "limit") ?? 50, 50, 1, 200);
  const runsLimit = clampInt(num2(args, "runs_limit") ?? 10, 10, 1, 50);
  let kind = kindRaw;
  if (kind === "auto") {
    if (batchId && !projectId && !taskId)
      kind = "runs";
    else if (projectId && !taskId)
      kind = "cutover";
    else if (taskId && !projectId)
      kind = "collect";
    else if (projectId && taskId)
      kind = "all";
    else if (batchId)
      kind = "runs";
    else {
      return {
        ok: false,
        error: "project_id_or_task_id_or_batch_id_required",
        detail: "Pass project_id (cutover batches), task_id (collect batches), and/or batch_id (evaluate runs)."
      };
    }
  }
  if (!["auto", "all", "cutover", "collect", "runs"].includes(kind)) {
    return { ok: false, error: "kind_invalid", detail: "kind must be auto|all|cutover|collect|runs" };
  }
  const wantCutover = kind === "all" || kind === "cutover";
  const wantCollect = kind === "all" || kind === "collect";
  const wantRuns = kind === "runs" || includeRuns && (wantCutover || Boolean(batchId));
  if (wantCutover && !projectId) {
    return { ok: false, error: "project_id_required", detail: "kind=cutover|all needs project_id" };
  }
  if (wantCollect && !taskId) {
    return { ok: false, error: "task_id_required", detail: "kind=collect|all needs task_id" };
  }
  if (kind === "runs" && !batchId) {
    return { ok: false, error: "batch_id_required", detail: "kind=runs needs cutover batch_id" };
  }
  let cutoverBatches = [];
  let collectBatches = [];
  let runs = [];
  if (wantCutover) {
    const res = await client.get(`/v1/biz-migration/projects/${encodeURIComponent(projectId)}/batches`, {}, signal);
    if (res.ok === false)
      return res;
    const items = Array.isArray(asRecord(res.data).items) ? asRecord(res.data).items : [];
    cutoverBatches = items.map((row) => slimCutoverBatch(asRecord(row))).filter((row) => {
      if (batchId && String(row.id || "") !== batchId)
        return false;
      if (status && String(row.status || "").toLowerCase() !== status)
        return false;
      return true;
    }).slice(0, limit);
  }
  if (wantCollect) {
    const res = await client.get(`/v1/biz-state/tasks/${encodeURIComponent(taskId)}/batches`, { limit }, signal);
    if (res.ok === false)
      return res;
    const items = Array.isArray(asRecord(res.data).items) ? asRecord(res.data).items : [];
    collectBatches = items.map((row) => slimCollectBatch(asRecord(row), taskId)).filter((row) => {
      if (status && String(row.status || "").toLowerCase() !== status)
        return false;
      return true;
    }).slice(0, limit);
  }
  if (wantRuns) {
    const runBatchIds = kind === "runs" ? [batchId] : cutoverBatches.map((b) => String(b.id || "").trim()).filter(Boolean).slice(0, includeRuns ? 5 : 0);
    if (kind === "runs" && batchId) {
      const res = await client.get(`/v1/biz-migration/batches/${encodeURIComponent(batchId)}/runs`, { limit: runsLimit }, signal);
      if (res.ok === false)
        return res;
      const items = Array.isArray(asRecord(res.data).items) ? asRecord(res.data).items : [];
      runs = items.map((row) => slimEvalRun(asRecord(row))).slice(0, runsLimit);
    } else if (includeRuns && runBatchIds.length > 0) {
      const settled = await Promise.all(runBatchIds.map(async (id) => {
        const res = await client.get(`/v1/biz-migration/batches/${encodeURIComponent(id)}/runs`, { limit: runsLimit }, signal);
        if (res.ok === false)
          return { batch_id: id, error: res, items: [] };
        const items = Array.isArray(asRecord(res.data).items) ? asRecord(res.data).items : [];
        return {
          batch_id: id,
          items: items.map((row) => slimEvalRun(asRecord(row))).slice(0, runsLimit)
        };
      }));
      for (const block of settled) {
        if ("error" in block && block.error) {
          const failed = cutoverBatches.find((b) => b.id === block.batch_id);
          if (failed)
            failed.runs_error = asRecord(block.error).error || "runs_fetch_failed";
          continue;
        }
        const target = cutoverBatches.find((b) => b.id === block.batch_id);
        if (target)
          target.runs = block.items;
        for (const r of block.items)
          runs.push(r);
      }
    }
  }
  return {
    ok: true,
    data: omitUndefined({
      kind,
      project_id: projectId || undefined,
      task_id: taskId || undefined,
      batch_id: batchId || undefined,
      cutover_batches: wantCutover ? cutoverBatches : undefined,
      collect_batches: wantCollect ? collectBatches : undefined,
      runs: kind === "runs" ? runs : undefined,
      counts: {
        cutover_batches: cutoverBatches.length,
        collect_batches: collectBatches.length,
        runs: runs.length
      },
      next: wantCutover ? "Use cutover batch id with netx__getBizMonitorBoard / listBizMonitorBatches(kind=runs). Collect batch id → netx__getBizCollectBatch." : wantCollect ? "Pass collect batch id to netx__getBizCollectBatch / getBizCollectCommandRaw." : "Pass run_id to netx__getBizMonitorDiffs or getBizMonitorBoard(run_id)."
    })
  };
}
async function getBizMonitorContext(client, args, signal) {
  const projectId = str2(args, "project_id").trim();
  const taskId = str2(args, "task_id").trim();
  if (!projectId && !taskId) {
    return { ok: false, error: "project_id_or_task_id_required" };
  }
  const params = {};
  if (projectId)
    params.project_id = projectId;
  if (taskId)
    params.task_id = taskId;
  return client.get("/v1/biz-migration/monitor-context", params, signal);
}
async function getBizMonitorBoard(client, args, signal) {
  const batchId = str2(args, "batch_id").trim();
  if (!batchId)
    return { ok: false, error: "batch_id_required" };
  const params = {};
  const runId = str2(args, "run_id").trim();
  if (runId)
    params.run_id = runId;
  return client.get(`/v1/biz-migration/batches/${encodeURIComponent(batchId)}/board`, params, signal);
}
async function listBizMonitorReds(client, args, signal) {
  const projectId = str2(args, "project_id").trim();
  if (!projectId)
    return { ok: false, error: "project_id_required" };
  const params = {};
  putStr(params, args, ["status"]);
  const limit = num2(args, "limit");
  if (limit !== undefined)
    params.limit = clampInt(limit, 200, 1, 500);
  return client.get(`/v1/biz-migration/projects/${encodeURIComponent(projectId)}/red-tickets`, params, signal);
}
async function getBizMonitorDiffs(client, args, signal) {
  const runId = str2(args, "run_id").trim();
  if (!runId)
    return { ok: false, error: "run_id_required" };
  const params = {};
  putStr(params, args, ["metric_id", "sheet_id", "verdict", "color", "q"]);
  const limit = num2(args, "limit");
  if (limit !== undefined)
    params.limit = clampInt(limit, 200, 1, 500);
  const offset = num2(args, "offset");
  if (offset !== undefined)
    params.offset = clampInt(offset, 0, 0, Number.MAX_SAFE_INTEGER);
  return client.get(`/v1/biz-migration/runs/${encodeURIComponent(runId)}/diffs`, params, signal);
}
async function getBizCollectBatch(client, args, signal) {
  const batchId = str2(args, "batch_id").trim();
  if (!batchId)
    return { ok: false, error: "batch_id_required" };
  return client.get(`/v1/biz-state/batches/${encodeURIComponent(batchId)}`, {}, signal);
}
async function getBizCollectCommandRaw(client, args, signal) {
  const batchId = str2(args, "batch_id").trim();
  const commandId = str2(args, "command_id").trim();
  if (!batchId || !commandId) {
    return { ok: false, error: "batch_id_and_command_id_required" };
  }
  return client.get(`/v1/biz-state/batches/${encodeURIComponent(batchId)}/commands/${encodeURIComponent(commandId)}`, {}, signal);
}

// src/netx/topology-handlers.ts
function asRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}
function str3(args, key, fallback = "") {
  const v = args[key];
  if (typeof v === "string")
    return v;
  if (typeof v === "number" || typeof v === "boolean")
    return String(v);
  return fallback;
}
function num3(args, key) {
  const v = args[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function bool3(args, key) {
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
    const v = str3(args, key).trim();
    if (v)
      out[key] = v;
  }
  return out;
}
function edgeEndpoints(edge) {
  const a = str3(edge, "a_node_id") || str3(edge, "a");
  const b = str3(edge, "b_node_id") || str3(edge, "b");
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
        row.a_name = str3(e, "a_name");
        row.b_name = str3(e, "b_name");
      } else {
        row.a_name = str3(e, "b_name");
        row.b_name = str3(e, "a_name");
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
      id: str3(row, "id") || str3(row, "fabric_node_id"),
      name: str3(row, "name"),
      x: row.x,
      y: row.y,
      level: row.level,
      role: row.role
    };
  });
  return {
    ok: true,
    view_id: str3(graph, "id") || str3(graph, "view_id"),
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
  const compact = bool3(args, "compact") !== false;
  const maxDepth = num3(args, "max_depth");
  if (!compact && maxDepth === undefined)
    return out;
  return { ...out, compact, max_depth: maxDepth ?? null };
}
async function getTopologyView(client, args, signal) {
  const viewId = str3(args, "view_id").trim();
  if (!viewId)
    return { ok: false, error: "view_id_required" };
  const out = unwrap(await client.get(`/v1/topology/views/${encodeURIComponent(viewId)}`, undefined, signal, 120000));
  if (out.ok !== true)
    return out;
  const detail = str3(args, "detail", "summary").trim().toLowerCase() || "summary";
  if (detail === "full")
    return { ...out, detail: "full" };
  return summarizeViewGraph(out, clampInt2(num3(args, "sample"), 20, 0, 200));
}
async function createTopologyFolder(client, args, signal) {
  const name = str3(args, "name").trim();
  if (!name)
    return { ok: false, error: "name_required" };
  const body = { name };
  const parentId = str3(args, "parent_id").trim();
  if (parentId)
    body.parent_id = parentId;
  const locale = str3(args, "locale").trim();
  if (locale)
    body.locale = locale;
  if (num3(args, "sort_order") !== undefined)
    body.sort_order = Math.trunc(num3(args, "sort_order"));
  return unwrap(await client.post("/v1/topology/folders", body, signal));
}
async function addTopologyViewNodes(client, args, signal) {
  const viewId = str3(args, "view_id").trim();
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
  if (num3(args, "max_nodes") !== undefined) {
    const got = unwrap(await client.get(`/v1/topology/views/${encodeURIComponent(viewId)}`, undefined, signal));
    if (got.ok === true) {
      const data = asRecord2(got.data);
      const filt = asRecord2(got.filter ?? data.filter);
      const membership = asRecord2(filt.membership ?? {});
      membership.max_nodes = clampInt2(num3(args, "max_nodes"), 2000, 1, 2000);
      filt.membership = membership;
      await client.patch(`/v1/topology/views/${encodeURIComponent(viewId)}`, { filter: filt }, signal);
    }
  }
  const layout = str3(args, "layout", "grid").trim() || "grid";
  const body = {
    managed_ne_ids: [],
    layout,
    ...filters
  };
  if (fabricIds.length)
    body.fabric_node_ids = fabricIds;
  if (num3(args, "limit") !== undefined)
    body.limit = clampInt2(num3(args, "limit"), 500, 1, 2000);
  if (num3(args, "offset") !== undefined)
    body.offset = clampInt2(num3(args, "offset"), 0, 0, Number.MAX_SAFE_INTEGER);
  return unwrap(await client.post(`/v1/topology/views/${encodeURIComponent(viewId)}/nodes`, body, signal, 180000));
}
async function removeTopologyViewNodes(client, args, signal) {
  const viewId = str3(args, "view_id").trim();
  if (!viewId)
    return { ok: false, error: "view_id_required" };
  const body = { ...filterFields(args) };
  const fabricIds = strList2(args, "fabric_node_ids");
  if (fabricIds.length)
    body.fabric_node_ids = fabricIds;
  return unwrap(await client.post(`/v1/topology/views/${encodeURIComponent(viewId)}/nodes/remove`, body, signal));
}
async function copyTopologyViewNodes(client, args, signal) {
  const sourceId = str3(args, "source_view_id").trim();
  const targetId = str3(args, "target_view_id").trim();
  if (!sourceId || !targetId) {
    return { ok: false, error: "source_view_id_and_target_view_id_required" };
  }
  const source = unwrap(await client.get(`/v1/topology/views/${encodeURIComponent(sourceId)}`, undefined, signal, 120000));
  if (source.ok !== true)
    return source;
  const nodes = Array.isArray(source.nodes) ? source.nodes : [];
  const limit = num3(args, "limit");
  const selected = typeof limit === "number" ? nodes.slice(0, clampInt2(limit, nodes.length, 1, 2000)) : nodes;
  const fabricIds = selected.map((n) => {
    const row = asRecord2(n);
    return str3(row, "id") || str3(row, "fabric_node_id");
  }).filter(Boolean);
  if (bool3(args, "dry_run") === true) {
    return { ok: true, dry_run: true, would_copy: fabricIds.length, source_view_id: sourceId, target_view_id: targetId };
  }
  if (bool3(args, "clear_target") === true) {
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
  if (bool3(args, "copy_positions") !== false) {
    const ox = num3(args, "offset_x") ?? 0;
    const oy = num3(args, "offset_y") ?? 0;
    const positions = selected.map((n) => {
      const row = asRecord2(n);
      const id = str3(row, "id") || str3(row, "fabric_node_id");
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
  const viewId = str3(args, "view_id").trim();
  if (!viewId)
    return { ok: false, error: "view_id_required" };
  const body = {};
  if (Array.isArray(args.positions))
    body.positions = args.positions;
  const layout = str3(args, "layout").trim();
  if (layout)
    body.layout = layout;
  Object.assign(body, filterFields(args));
  for (const key of ["offset_x", "offset_y", "cols", "gap_x", "gap_y"]) {
    if (num3(args, key) !== undefined)
      body[key] = num3(args, key);
  }
  const fabricIds = strList2(args, "fabric_node_ids");
  if (fabricIds.length)
    body.fabric_node_ids = fabricIds;
  return unwrap(await client.patch(`/v1/topology/views/${encodeURIComponent(viewId)}/positions`, body, signal, 120000));
}
async function projectTopologyNeighbors(client, args, signal) {
  const viewId = str3(args, "view_id").trim();
  if (!viewId)
    return { ok: false, error: "view_id_required" };
  const body = {};
  const seeds = strList2(args, "seed_fabric_node_ids").length ? strList2(args, "seed_fabric_node_ids") : strList2(args, "fabric_node_ids");
  if (seeds.length)
    body.seed_fabric_node_ids = seeds;
  const mids = strList2(args, "managed_ne_ids");
  if (mids.length)
    body.managed_ne_ids = mids;
  const region = str3(args, "region_folder_id").trim();
  if (region)
    body.region_folder_id = region;
  const out = unwrap(await client.post(`/v1/topology/views/${encodeURIComponent(viewId)}/project-neighbors`, body, signal, 180000));
  if (out.ok !== true)
    return out;
  const detail = str3(args, "detail", "summary").trim().toLowerCase() || "summary";
  if (detail === "full" || detail === "raw" || detail === "graph") {
    return { ...out, detail: "full", projected: true };
  }
  return { ...summarizeViewGraph(out, clampInt2(num3(args, "sample"), 20, 0, 100)), projected: true, view_id: viewId };
}
async function queryTopologyFabricNodes(client, args, signal) {
  let mode = str3(args, "mode").trim().toLowerCase();
  const q = str3(args, "q").trim();
  const keyword = str3(args, "keyword").trim();
  if (!mode) {
    if (bool3(args, "summary") === true)
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
      page: clampInt2(num3(args, "page"), 1, 1, Number.MAX_SAFE_INTEGER),
      page_size: clampInt2(num3(args, "page_size") ?? num3(args, "limit"), 50, 1, 200)
    }, signal));
  }
  const params = {
    page: clampInt2(num3(args, "page"), 1, 1, Number.MAX_SAFE_INTEGER),
    page_size: clampInt2(num3(args, "page_size") ?? num3(args, "limit"), 50, 1, 500)
  };
  for (const key of ["keyword", "role", "level", "level_major", "region_folder_id", "link_status"]) {
    const v = str3(args, key).trim() || (key === "keyword" ? q : "");
    if (v)
      params[key] = v;
  }
  const out = unwrap(await client.get("/v1/topology/fabric/nodes", params, signal));
  return out.ok === true ? { ...out, mode: "list" } : out;
}
async function classifyTopologyFabricNodes(client, args, signal) {
  const action = str3(args, "action").trim().toLowerCase();
  if (!action)
    return { ok: false, error: "action_required" };
  if (action === "match") {
    const pattern = str3(args, "pattern").trim() || str3(args, "q").trim();
    if (!pattern)
      return { ok: false, error: "pattern_required" };
    return unwrap(await client.post("/v1/topology/fabric/nodes/match", {
      pattern,
      match_field: str3(args, "match_field", "name").trim() || "name",
      sample_limit: clampInt2(num3(args, "sample_limit"), 50, 1, 200)
    }, signal));
  }
  if (action === "tag") {
    const body = {
      fabric_node_ids: strList2(args, "fabric_node_ids"),
      dry_run: bool3(args, "dry_run") === true
    };
    const pattern = str3(args, "pattern").trim() || str3(args, "q").trim();
    if (pattern)
      body.pattern = pattern;
    if (args.level !== undefined)
      body.level = args.level;
    const role = str3(args, "role").trim();
    if (role)
      body.role = role;
    const region = str3(args, "region_folder_id").trim();
    if (region)
      body.region_folder_id = region;
    if (bool3(args, "clear_region") === true)
      body.clear_region = true;
    return unwrap(await client.post("/v1/topology/fabric/nodes/tags/bulk", body, signal));
  }
  if (action === "patch") {
    const nodeId = str3(args, "fabric_node_id").trim() || str3(args, "node_id").trim();
    if (!nodeId)
      return { ok: false, error: "fabric_node_id_required" };
    const body = {};
    if (args.level !== undefined)
      body.level = args.level;
    const role = str3(args, "role").trim();
    if (role)
      body.role = role;
    const region = str3(args, "region_folder_id").trim();
    if (region)
      body.region_folder_id = region;
    if (bool3(args, "clear_region") === true)
      body.clear_region = true;
    return unwrap(await client.patch(`/v1/topology/fabric/nodes/${encodeURIComponent(nodeId)}/tags`, body, signal));
  }
  if (action === "unmatched") {
    return unwrap(await client.get("/v1/topology/classify/unmatched", {
      kind: str3(args, "kind", "any").trim() || "any",
      page: clampInt2(num3(args, "page"), 1, 1, Number.MAX_SAFE_INTEGER),
      page_size: clampInt2(num3(args, "page_size") ?? num3(args, "limit"), 50, 1, 500)
    }, signal));
  }
  if (action === "preview_rules") {
    return unwrap(await client.post("/v1/topology/classify/preview", {}, signal));
  }
  if (action === "apply_rules") {
    const params = {};
    if (bool3(args, "overwrite_manual") === true)
      params.skip_manual = false;
    else if (bool3(args, "skip_manual") !== undefined)
      params.skip_manual = bool3(args, "skip_manual") !== false;
    if (bool3(args, "fill_empty_only") === true)
      params.fill_empty_only = true;
    return unwrap(await client.post("/v1/topology/classify/apply", {}, signal));
  }
  if (action === "list_rules") {
    return unwrap(await client.get("/v1/topology/classify/rules", undefined, signal));
  }
  return { ok: false, error: "unknown_action", action };
}
async function queryTopologyNeighborhood(client, args, signal) {
  const nodeId = str3(args, "node_id").trim();
  if (!nodeId)
    return { ok: false, error: "node_id_required" };
  const out = unwrap(await client.get("/v1/topology/fabric/neighborhood", {
    node_id: nodeId,
    depth: clampInt2(num3(args, "depth"), 1, 1, 3),
    layer: str3(args, "layer", "physical").trim() || "physical"
  }, signal));
  if (out.ok !== true)
    return out;
  const edges = Array.isArray(out.edges) ? out.edges : [];
  return { ...out, links: collapseEdgesToLinks(edges) };
}
async function queryTopologyEdges(client, args, signal) {
  const params = {
    page: clampInt2(num3(args, "page"), 1, 1, Number.MAX_SAFE_INTEGER),
    page_size: clampInt2(num3(args, "page_size"), 100, 1, 500),
    layer: str3(args, "layer", "physical").trim() || "physical"
  };
  for (const key of ["node_id", "keyword", "status", "source"]) {
    const v = str3(args, key).trim();
    if (v)
      params[key] = v;
  }
  const out = unwrap(await client.get("/v1/topology/fabric/edges", params, signal));
  if (out.ok !== true)
    return out;
  const detail = str3(args, "detail", "adjacency").trim().toLowerCase() || "adjacency";
  const items = Array.isArray(out.items) ? out.items : Array.isArray(out.edges) ? out.edges : [];
  if (detail === "ports")
    return { ...out, detail: "ports", items };
  const links = collapseEdgesToLinks(items, true);
  return { ...out, detail: "adjacency", links, items: undefined };
}
async function suggestSinkHubs(client, args, signal) {
  const viewId = str3(args, "source_view_id").trim() || str3(args, "view_id").trim();
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
  const pick = clampInt2(num3(args, "pick"), 5, 1, 50);
  const hubs = [...degree.entries()].filter(([id]) => !exclude.has(id)).sort((a, b) => b[1] - a[1]).slice(0, pick).map(([fabric_node_id, deg]) => {
    const node = nodes.find((n) => {
      const row2 = asRecord2(n);
      return (str3(row2, "id") || str3(row2, "fabric_node_id")) === fabric_node_id;
    });
    const row = asRecord2(node);
    return {
      fabric_node_id,
      degree: deg,
      name: str3(row, "name"),
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
  const viewId = str3(args, "view_id").trim();
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
    detail: str3(args, "detail", "summary") || "summary",
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
    source_view_id: str3(args, "source_view_id"),
    sink_view_id: str3(args, "sink_view_id"),
    hint: "sinkTopologyDualUnits needs the dual_unit layout engine from netx-topology MCP. Use layoutTopologyView(action=move_nodes, park=true) for HTTP-only parking, or enable the topology MCP."
  };
}
async function layoutTopologyView(client, args, signal) {
  if (bool3(args, "catalog") === true) {
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
  const action = str3(args, "action", "layout").trim().toLowerCase() || "layout";
  if (action === "job_status" || action === "job_cancel") {
    return {
      ok: false,
      error: "layout_jobs_not_in_dsh_host",
      hint: "Background layout jobs are owned by netx-topology MCP."
    };
  }
  if (action === "move_nodes" || action === "sink_nodes") {
    const toId = str3(args, "view_id").trim();
    const fromId = str3(args, "source_view_id").trim();
    const ids = strList2(args, "fabric_node_ids");
    const params = asRecord2(args.params);
    const fabricIds = ids.length ? ids : strList2(params, "fabric_node_ids");
    if (!toId || !fromId) {
      return { ok: false, error: "view_id_and_source_view_id_required" };
    }
    if (fabricIds.length === 0) {
      return { ok: false, error: "fabric_node_ids_required" };
    }
    const copyPositions = bool3(params, "copy_positions") !== false && bool3(args, "copy_positions") !== false;
    const removeFromSource = bool3(params, "remove_from_source") !== false;
    const source = unwrap(await client.get(`/v1/topology/views/${encodeURIComponent(fromId)}`, undefined, signal, 120000));
    if (source.ok !== true)
      return source;
    const nodes = Array.isArray(source.nodes) ? source.nodes : [];
    const wanted = new Set(fabricIds);
    const selected = nodes.filter((n) => {
      const row = asRecord2(n);
      const id = str3(row, "id") || str3(row, "fabric_node_id");
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
          fabric_node_id: str3(row, "id") || str3(row, "fabric_node_id"),
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
      park: bool3(params, "park") === true || bool3(args, "park") === true
    };
  }
  return layoutRecipeUnavailable(action);
}

// src/netx/tools.ts
function packageVersion() {
  try {
    const here = dirname6(fileURLToPath3(import.meta.url));
    const pkg = JSON.parse(readFileSync7(join11(here, "..", "package.json"), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "0";
  } catch {
    return "0";
  }
}
var MUTATING_TOOLS = new Set([
  "netx__execManagedNe",
  "netx__createTopologyFolder",
  "netx__addTopologyViewNodes",
  "netx__removeTopologyViewNodes",
  "netx__copyTopologyViewNodes",
  "netx__updateTopologyViewPositions",
  "netx__projectTopologyNeighbors",
  "netx__classifyTopologyFabricNodes",
  "netx__layoutTopologyView"
]);
var str4 = (description) => ({ type: "string", ...description ? { description } : {} });
var num4 = (description) => ({ type: "number", ...description ? { description } : {} });
var bool4 = (description) => ({ type: "boolean", ...description ? { description } : {} });
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
function renderJson2(_args, value) {
  return [{ type: "text", text: JSON.stringify(value, null, 0) }];
}
var jsonOut2 = {
  schema: { type: "object", additionalProperties: true },
  render: renderJson2
};
function tool2(name, description, parameters, handler, getClient, timeoutMs) {
  return defineTool2({
    name,
    description,
    parameters,
    output: jsonOut2,
    timeoutMs,
    isConcurrencySafe: () => !MUTATING_TOOLS.has(name),
    async execute(args, exec) {
      const result = await handler(getClient(), args, exec.signal);
      const safe = toLosslessJson(result);
      if (result.ok === false || safe.ok === false) {
        throw new Error(JSON.stringify(safe));
      }
      return safe;
    }
  });
}
function registerNetxTools(ctx, connection, options) {
  const enabledGroups = connection.toolsEnabled === false ? [] : options.forceGroups ?? groupsForPlane(connection.groups, options.plane, options.only);
  const id = getToolMountId(ctx, options.source ?? options.plane);
  const allow = toolNamesForGroups(enabledGroups);
  if (allow.size === 0) {
    publishToolMountStatus({
      id,
      version: packageVersion(),
      plane: options.plane,
      groups: [...enabledGroups],
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
  const client = createNetxClient({
    apiUrl: connection.apiUrl,
    lang: connection.lang,
    timeoutMs: Math.min(t, 45000),
    getToken: () => {
      const live = getNetxConnection();
      return live ? live.token.trim() : connection.token.trim();
    },
    getApiUrl: () => getNetxConnection()?.apiUrl ?? connection.apiUrl
  });
  const getClient = () => client;
  const catalog = [
    tool2("netx__queryNmsAlarms", "Query NMS current alarms (each row includes host_name). Supports severity/ne_id/host_name/keyword, last_seen time_from/time_to, pagination. Prefer host_name for display; ne_id is for filters only.", {
      severity: str4(),
      ne_id: str4("Filter only; do not show UUID to users"),
      host_name: str4("Filter by NE host_name"),
      ne_name: str4("Legacy alias mapped to keyword"),
      keyword: str4("Substring on cause/object/event. Examples: LOS, Fiber Break, bandwidth, CRC."),
      time_from: str4("ISO time; filters last_seen_at >="),
      time_to: str4("ISO time; filters last_seen_at <="),
      page: num4(),
      page_size: num4()
    }, queryUmeAlarms, getClient, t),
    tool2("netx__aggregateNmsAlarms", "Aggregate NMS current alarms (by_severity + top by_ne). If group_by is set, routes to aggregateUmeAlarmsRaw. Always filter severity/keyword/time before paging.", {
      severity: str4("Optional perceived_severity filter (critical/major/minor/warning)."),
      top_ne: num4("Max NE buckets (default 50). Ignored when group_by is set."),
      exclude_missing_host: bool4("Omit missing host_name from by_ne."),
      time_from: str4(),
      time_to: str4(),
      group_by: str4("When set, routes to raw aggregation. Prefer alarm_host_name."),
      group_by2: str4(),
      is_cleared: str4(),
      ne_id: str4(),
      event_type: str4(),
      keyword: str4(),
      limit: num4()
    }, aggregateUmeAlarms, getClient, t),
    tool2("netx__runNmsDiagnostics", "NMS alarm diagnostics: severity, top_event_types, top_alarm_codes, top_ne, protocol buckets, freshness meta.", {}, runUmeDiagnostics, getClient, t),
    tool2("netx__queryNmsNeInventory", "Paged NMS NE inventory synced in netx (keyword matches ne_id/ne_name/user_label/ip/host_name).", {
      keyword: str4(),
      page: num4(),
      page_size: num4()
    }, queryUmeNeInventory, getClient, t),
    tool2("netx__getNmsNe", "Get single NMS NE detail by ne_id (UUID).", {
      ne_id: { type: "string", required: true, description: "NMS inventory ne_id (UUID)." }
    }, getUmeNe, getClient, t),
    tool2("netx__queryNmsAlarmsRaw", "Power query NMS current alarms with full alarm_* + ne_* fields; optional field_preset or select_fields. Use field_preset=evidence for citations.", {
      severity: str4(),
      is_cleared: str4(),
      ne_id: str4(),
      event_type: str4(),
      keyword: str4(),
      time_from: str4(),
      time_to: str4(),
      order_by: str4("last_seen_at | time_created | perceived_severity | event_type | ne_id"),
      order: str4("asc | desc"),
      select_fields: strArr(),
      field_preset: str4("brief | evidence | ne_debug"),
      page: num4(),
      page_size: num4()
    }, queryUmeAlarmsRaw, getClient, t),
    tool2("netx__aggregateNmsAlarmsRaw", "Dynamic aggregation on NMS raw fields (group_by/group_by2); prefer alarm_host_name.", {
      group_by: { type: "string", required: true },
      group_by2: str4(),
      severity: str4(),
      is_cleared: str4(),
      ne_id: str4(),
      event_type: str4(),
      keyword: str4(),
      time_from: str4(),
      time_to: str4(),
      exclude_missing_host: bool4(),
      limit: num4()
    }, aggregateUmeAlarmsRaw, getClient, t),
    tool2("netx__listNmsAlarmFields", "List available fields for NMS raw alarm queries.", {}, listUmeAlarmFields, getClient, t),
    tool2("netx__sqlQueryNms", "Read-only SELECT on NMS tables (ume_alarms_current/ume_inventory_ne); server enforces limits. Requires sql:query scope.", {
      sql: { type: "string", required: true },
      limit: num4(),
      statement_timeout_ms: num4()
    }, sqlQueryUme, getClient, t),
    tool2("netx__listManagedNe", "List filtered netx managed NEs (keyword/vendor/connect_status required); use before execManagedNe.", {
      keyword: str4(),
      vendor: str4(),
      connect_status: str4("unknown | testing | pass | fail"),
      page: num4(),
      page_size: num4()
    }, listManagedNe, getClient, t),
    tool2("netx__getManagedNe", "Get one managed NE by managed ne_id (from listManagedNe / listCliTargets source=managed). Response includes capability (device_family, exec_policy_effective, recommended_mode, hints) — read before complex execManagedNe. Do NOT pass NMS inventory UUID here.", {
      ne_id: str4("Managed NE id"),
      managed_ne_id: str4("Alias for ne_id"),
      id: str4("Alias for ne_id")
    }, getManagedNe, getClient, t),
    tool2("netx__execManagedNe", "Run CLI via netx (readonly show/display/ping/traceroute; linux_shell on Linux/MikroTik allows scripts). Single NE: ne_id OR nms_ne_id + commands. Many NEs: ne_ids[]/nms_ne_ids[] + shared commands, or targets[{nms_ne_id|ne_id, commands}]. Do NOT loop one-NE calls for multi-NE work. Long or multi-NE: async=true (or auto when ≥4 NEs) returns job_id — poll getNeExecJob. Read getManagedNe.capability first.", {
      ne_id: str4(),
      nms_ne_id: str4("NMS inventory id; alias ume_ne_id"),
      ume_ne_id: str4("Legacy alias of nms_ne_id"),
      ne_ids: strArr("Managed NE ids for concurrent batch (shared commands)."),
      nms_ne_ids: strArr("NMS inventory ids; alias ume_ne_ids"),
      ume_ne_ids: strArr("Legacy alias of nms_ne_ids"),
      targets: {
        type: "array",
        description: "Per-NE command sets: each item is one NE (ne_id OR nms_ne_id) with commands[].",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            ne_id: str4(),
            nms_ne_id: str4(),
            ume_ne_id: str4(),
            commands: strArr()
          }
        }
      },
      commands: strArr("Commands for single NE, or shared commands for batch."),
      read_timeout_sec: num4("Per-command read timeout (default 60; use 90–120 for slow show)."),
      concurrency: num4("Parallel NEs for batch mode (1–8, default 4)."),
      async: bool4("true=background job_id + getNeExecJob; false=force sync; omit=auto for ~4+ NEs (NETX_NE_EXEC_ASYNC_MIN_NES).")
    }, execManagedNe, getClient, Math.max(t, 300000)),
    tool2("netx__getNeExecJob", "Poll a background execManagedNe job (job_id from async ack). When terminal=true, result holds exec/exec-batch payload. Do not busy-wait in the same turn.", {
      job_id: str4("Job id from execManagedNe async response.")
    }, getNeExecJob, getClient, Math.max(t, 60000)),
    tool2("netx__listCliTargets", "List CLI-capable targets (managed NE and/or NMS inventory). Call once per session with keyword/source, cache ids, then execManagedNe.", {
      source: str4("managed | nms | ume | all"),
      keyword: str4(),
      page: num4(),
      page_size: num4()
    }, listCliTargets, getClient, t),
    tool2("netx__findTopologyPaths", "Find up to max_paths simple paths between two fabric nodes (common group — native netx, not NMS-bound). For each endpoint provide exactly one of ume_ne_id or managed_ne_id.", {
      from_nms_ne_id: str4("NMS inventory id"),
      from_ume_ne_id: str4("Legacy alias of from_nms_ne_id"),
      from_managed_ne_id: str4(),
      to_nms_ne_id: str4("NMS inventory id"),
      to_ume_ne_id: str4("Legacy alias of to_nms_ne_id"),
      to_managed_ne_id: str4(),
      max_paths: num4(),
      max_hops: num4(),
      layer: str4(),
      detail: str4("summary | full")
    }, findTopologyPaths, getClient, t),
    tool2("netx__listBizMonitors", "Catalog: list cutover/monitor-compare projects and biz_state monitor tasks. No project_id needed — call this first when the user did not give an id, then listBizMonitorBatches / getBizMonitorContext.", {
      kind: str4("all | projects | tasks (default all)"),
      purpose: str4("Filter tasks: portrait | cutover_hf | empty=all"),
      status: str4("Filter by status (e.g. active / paused)"),
      q: str4("Keyword on name / ne_name / note / id"),
      limit: num4("Max rows per list (default 100, max 500)")
    }, listBizMonitors, getClient, t),
    tool2("netx__listBizMonitorBatches", "List batch ids for further analysis. project_id → cutover batches; task_id → biz_state collect batches; batch_id + kind=runs → evaluate runs. Optional include_runs attaches recent runs onto cutover batches.", {
      kind: str4("auto | all | cutover | collect | runs (default auto)"),
      project_id: str4("Cutover project id → cutover_batches"),
      task_id: str4("biz_state task id → collect_batches"),
      batch_id: str4("Cutover batch id (filter or kind=runs)"),
      include_runs: bool4("Attach recent evaluate runs onto listed cutover batches"),
      status: str4("Filter batch status"),
      limit: num4("Max batches (default 50)"),
      runs_limit: num4("Max runs per batch when include_runs / kind=runs (default 10)")
    }, listBizMonitorBatches, getClient, t),
    tool2("netx__getBizMonitorContext", "Biz-monitor definition bundle: cutover project + monitor/compare templates + iface normalize + port mapping + related tasks/commands. Prefer project_id from listBizMonitors. Display keys are device-raw A/B.", {
      project_id: str4("Cutover / biz-migration project id"),
      task_id: str4("biz_state task id (optional if project_id set)")
    }, getBizMonitorContext, getClient, t),
    tool2("netx__getBizMonitorBoard", "Cutover batch board: project/batch status, evaluate run summary, sheet cards, verdict counts, metric_batches.", {
      batch_id: { type: "string", required: true },
      run_id: str4("Optional evaluate run id")
    }, getBizMonitorBoard, getClient, t),
    tool2("netx__listBizMonitorReds", "Open/carried red tickets. Each item has old_key/new_key (raw A/B) and evidence (device, collect time, show command, iface raw→norm→map).", {
      project_id: { type: "string", required: true },
      status: str4("open|carried|resolved or empty=all"),
      limit: num4()
    }, listBizMonitorReds, getClient, t),
    tool2("netx__getBizMonitorDiffs", "Paged evaluate diffs. Rows expose old_key/new_key (raw A/B), match_* keys, status, evidence with show commands.", {
      run_id: { type: "string", required: true },
      metric_id: str4(),
      sheet_id: str4(),
      verdict: str4(),
      color: str4("e.g. red"),
      q: str4(),
      limit: num4(),
      offset: num4()
    }, getBizMonitorDiffs, getClient, t),
    tool2("netx__getBizCollectBatch", "One biz_state collect batch: commands (raw_command, parse_status, preview), parsed metrics.", {
      batch_id: { type: "string", required: true }
    }, getBizCollectBatch, getClient, t),
    tool2("netx__getBizCollectCommandRaw", "Full CLI raw_text for one collect command inside a batch (deep dive).", {
      batch_id: { type: "string", required: true },
      command_id: { type: "string", required: true }
    }, getBizCollectCommandRaw, getClient, t),
    tool2("netx__getTopologyTree", "Get topology folder tree (nav roots + Root map canvases). Start here before createTopologyFolder.", { compact: bool4(), max_depth: num4() }, getTopologyTree, getClient, t),
    tool2("netx__getTopologyView", "Get a topology view by view_id. Default detail=summary with sample_nodes + links[].", {
      view_id: { type: "string", required: true },
      detail: str4("summary | full"),
      sample: num4()
    }, getTopologyView, getClient, t),
    tool2("netx__createTopologyFolder", "Create topology folders / region canvases. Only way to create canvases (ne:write).", {
      name: { type: "string", required: true },
      parent_id: str4(),
      locale: str4("zh | en"),
      sort_order: num4()
    }, createTopologyFolder, getClient, t),
    tool2("netx__addTopologyViewNodes", "Bulk-place fabric nodes on a view via filters or fabric_node_ids (never managed/UME ids).", {
      view_id: { type: "string", required: true },
      max_nodes: num4(),
      keyword: str4(),
      role: str4(),
      vendor: str4(),
      link_status: str4(),
      limit: num4(),
      offset: num4(),
      fabric_node_ids: strArr(),
      layout: str4("grid | keep")
    }, addTopologyViewNodes, getClient, t),
    tool2("netx__removeTopologyViewNodes", "Remove placements from a view (not fabric) by filters or fabric_node_ids.", {
      view_id: { type: "string", required: true },
      keyword: str4(),
      role: str4(),
      vendor: str4(),
      link_status: str4(),
      fabric_node_ids: strArr()
    }, removeTopologyViewNodes, getClient, t),
    tool2("netx__copyTopologyViewNodes", "Clone fabric placements from source_view_id onto target_view_id (optional clear_target / copy_positions).", {
      source_view_id: { type: "string", required: true },
      target_view_id: { type: "string", required: true },
      copy_positions: bool4(),
      clear_target: bool4(),
      offset_x: num4(),
      offset_y: num4(),
      limit: num4(),
      dry_run: bool4()
    }, copyTopologyViewNodes, getClient, t),
    tool2("netx__updateTopologyViewPositions", "Move nodes on a view via positions[] or layout=grid|offset|stack + filters.", {
      view_id: { type: "string", required: true },
      positions: {
        type: "array",
        description: "Manual placements: [{ fabric_node_id, x, y }, …]",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            fabric_node_id: str4(),
            x: num4(),
            y: num4()
          }
        }
      },
      layout: str4("grid | offset | stack"),
      keyword: str4(),
      role: str4(),
      vendor: str4(),
      link_status: str4(),
      fabric_node_ids: strArr(),
      offset_x: num4(),
      offset_y: num4()
    }, updateTopologyViewPositions, getClient, t),
    tool2("netx__projectTopologyNeighbors", "Project existing fabric neighbors of on-view nodes onto the canvas.", {
      view_id: { type: "string", required: true },
      seed_fabric_node_ids: strArr(),
      managed_ne_ids: strArr(),
      region_folder_id: str4(),
      detail: str4("summary | full"),
      sample: num4()
    }, projectTopologyNeighbors, getClient, t),
    tool2("netx__queryTopologyFabricNodes", "Fabric inventory: mode=summary|list|search (keyword/role/level/region/link_status).", {
      mode: str4("summary | list | search"),
      q: str4(),
      keyword: str4(),
      role: str4(),
      level: str4(),
      level_major: str4(),
      region_folder_id: str4(),
      link_status: str4(),
      page: num4(),
      page_size: num4(),
      limit: num4(),
      summary: bool4()
    }, queryTopologyFabricNodes, getClient, t),
    tool2("netx__classifyTopologyFabricNodes", "Classify fabric nodes: action=match|tag|patch|unmatched|preview_rules|apply_rules|list_rules.", {
      action: { type: "string", required: true },
      pattern: str4(),
      q: str4(),
      match_field: str4(),
      sample_limit: num4(),
      fabric_node_ids: strArr(),
      fabric_node_id: str4(),
      node_id: str4(),
      level: str4(),
      role: str4(),
      region_folder_id: str4(),
      clear_region: bool4(),
      dry_run: bool4(),
      kind: str4(),
      page: num4(),
      page_size: num4(),
      skip_manual: bool4(),
      overwrite_manual: bool4(),
      fill_empty_only: bool4()
    }, classifyTopologyFabricNodes, getClient, t),
    tool2("netx__queryTopologyNeighborhood", "Neighborhood around a fabric node (depth 1–3) with compact links[].", {
      node_id: { type: "string", required: true },
      depth: num4(),
      layer: str4()
    }, queryTopologyNeighborhood, getClient, t),
    tool2("netx__queryTopologyEdges", "Fabric adjacency links[] (detail=adjacency) or port rows (detail=ports).", {
      node_id: str4(),
      keyword: str4(),
      layer: str4(),
      status: str4(),
      source: str4("lldp | ume | manual"),
      detail: str4("adjacency | ports"),
      page: num4(),
      page_size: num4()
    }, queryTopologyEdges, getClient, t),
    tool2("netx__suggestSinkHubs", "Rank hub territories on a source view for non-dual move_nodes(park) batches (degree stand-in in DSH).", {
      source_view_id: str4(),
      view_id: str4(),
      pick: num4(),
      exclude_portal_ids: strArr(),
      exclude_fabric_node_ids: strArr()
    }, suggestSinkHubs, getClient, t),
    tool2("netx__analyzeTopologyViewLayout", "Basic layout QA for a view (bbox/hubs). Full dual_unit/crossing scores need netx-topology MCP.", {
      view_id: str4(),
      folder_id: str4(),
      detail: str4("summary | structure | hotspots | blocks | both"),
      score_profile: str4(),
      sight_limit: num4(),
      max_views: num4(),
      min_nodes: num4(),
      max_nodes: num4(),
      with_meta: bool4()
    }, analyzeTopologyViewLayout, getClient, t),
    tool2("netx__sinkTopologyDualUnits", "Drain dual_unit eyes from source to sink (requires netx-topology MCP layout engine in DSH).", {
      source_view_id: str4(),
      sink_view_id: str4(),
      max_units: num4(),
      min_nodes: num4(),
      max_nodes: num4(),
      max_batch_nodes: num4(),
      layout_batch: bool4(),
      until_empty: bool4(),
      dry_run: bool4()
    }, sinkTopologyDualUnits, getClient, t),
    tool2("netx__layoutTopologyView", "Layout / polish a canvas. DSH supports catalog + move_nodes|sink_nodes over HTTP; dual_unit/orbit/polish recipes need netx-topology MCP.", {
      view_id: str4(),
      action: str4(),
      source_view_id: str4(),
      recipe: str4(),
      preset: str4(),
      mode: str4("preview | apply"),
      tune: bool4(),
      params: anyObj("Action-specific options (move_nodes / recipes / polish)."),
      catalog: bool4(),
      fabric_node_ids: strArr(),
      park: bool4(),
      copy_positions: bool4()
    }, layoutTopologyView, getClient, Math.max(t, 180000))
  ];
  const selected = catalog.filter((entry) => allow.has(entry.name));
  const names = selected.map((entry) => entry.name);
  const disposers = [];
  try {
    for (const entry of selected)
      disposers.push(ctx.tools.register(entry));
    publishToolMountStatus({
      id,
      version: packageVersion(),
      plane: options.plane,
      groups: [...enabledGroups],
      names,
      count: names.length,
      at: new Date().toISOString(),
      source: options.source ?? options.plane
    });
  } catch (error) {
    for (const dispose of disposers.reverse())
      dispose();
    publishToolMountStatus({
      id,
      version: packageVersion(),
      plane: options.plane,
      groups: [...enabledGroups],
      names: [],
      count: 0,
      at: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      source: options.source ?? options.plane
    });
    throw error;
  }
  return () => {
    for (const dispose of disposers)
      dispose();
    removeToolMountStatus(id);
  };
}

// src/netx/preset-publication.ts
import { createScope, scopeOf } from "@deepseek-ai/dsh-scope";

// src/netx/group-tools-plugin.ts
import { readFileSync as readFileSync8 } from "node:fs";
import { dirname as dirname7, join as join12 } from "node:path";
import { fileURLToPath as fileURLToPath4 } from "node:url";
function packageVersion2() {
  try {
    const here = dirname7(fileURLToPath4(import.meta.url));
    const pkg = JSON.parse(readFileSync8(join12(here, "..", "package.json"), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "0";
  } catch {
    return "0";
  }
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
        source: options.name
      });
      ctx.logger.info("%s: groups=[%s] → %s tokenConfigured=%s live=%s", options.name, enabled.join(",") || "(none)", connection.apiUrl, connection.token.trim().length > 0, getNetxConnection() !== undefined);
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
      const enabled = resolveGroups();
      registerGroupSkills(skillsCtx, enabled, options.name, skillAbort.signal).then((dispose) => {
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
  groupKbPublic: vol(z.boolean().default(false))
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
    const here = dirname8(fileURLToPath5(import.meta.url));
    const pkg = JSON.parse(readFileSync9(join13(here, "..", "package.json"), "utf8"));
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
    const stopKbWatch = watchKbContext(() => {
      remountKbLocal();
    });
    remountHostTools();
    remountKbLocal();
    ctx.effect(() => () => {
      stopWatch();
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
  const publish = () => {
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
  publish();
  ctx.on("loader/volatile-update", () => {
    publish();
  });
  installNetxopsSettings(ctx, config, {
    setSource: (current) => {
      source = () => readConfigSnapshot(current());
    },
    onChange: () => {
      publish();
    }
  });
  ctx.inject(["credentials"], (credCtx) => {
    credentialsCtx = credCtx;
    publish();
    credCtx.on("credentials/reference-updated", (ref) => {
      if (String(ref) === resolveTokenCredentialRef(source().tokenCredentialRef))
        publish();
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
      registerGroupSkills(skillsCtx, enabled, "netxops-host", skillAbort.signal).then((dispose) => {
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
      return {
        ok: true,
        value: {
          mount: mount ?? null,
          mounts: getToolMountStatuses(),
          connection: connection ? {
            apiUrl: connection.apiUrl,
            toolsEnabled: connection.toolsEnabled !== false,
            tokenConfigured: connection.token.trim().length > 0,
            hostGroups: connection.toolsEnabled === false ? [] : groupsForPlane(connection.groups, "host"),
            presetGroups: connection.toolsEnabled === false ? [] : groupsForPlane(connection.groups, "preset"),
            publicGroups: connection.toolsEnabled === false ? [] : groupsForPlane(connection.groups, "public")
          } : null
        }
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
