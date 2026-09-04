// src/index.ts
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import z from "@deepseek-ai/schemastery";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import * as DshSettings from "@deepseek-ai/dsh-settings";

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
function publishNetxConnection(next) {
  const state = store();
  state.connection = next;
  for (const listener of state.listeners)
    listener();
}

// src/index.ts
var name = "netxops";
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
  let publishing = Promise.resolve();
  let generation = 0;
  if (config.installAgentPreset) {
    ensureAgentPresetInstalled(ctx.logger);
  }
  const publish = () => {
    publishing = publishing.then(async () => {
      const gen = ++generation;
      const current = source();
      const token = await resolveToken(ctx, current.tokenCredentialRef);
      if (gen !== generation)
        return;
      publishNetxConnection({
        apiUrl: current.apiUrl.replace(/\/$/, ""),
        token,
        lang: current.lang,
        toolCallTimeoutMs: current.toolCallTimeoutMs
      });
      ctx.logger.info("netxops: published connection → %s", current.apiUrl.replace(/\/$/, ""));
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
  ctx.effect(() => () => {
    generation += 1;
  }, "netxops: dispose host bridge");
}
export {
  name,
  ensureAgentPresetInstalled,
  apply,
  NETXOPS_SETTINGS_NAMESPACE,
  NETXOPS_PRESET_ID,
  DEFAULT_TOKEN_REF,
  Config
};
