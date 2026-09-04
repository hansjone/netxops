// src/index.ts
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import z from "@deepseek-ai/schemastery";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import * as DshSettings from "@deepseek-ai/dsh-settings";
import * as McpClient from "@deepseek-ai/dsh-mcp-client";
var name = "netxops";
var inject = ["tools"];
var NETXOPS_SETTINGS_NAMESPACE = "netxops";
var NETXOPS_PRESET_ID = "netxops";
var DEFAULT_TOKEN_REF = "NETX_API_TOKEN";
var Config2 = z.object({
  apiUrl: z.string().default("http://127.0.0.1:8890"),
  lang: z.string().default("zh"),
  pythonCommand: z.string().default("python"),
  tokenCredentialRef: z.string().role("credential-ref").default(DEFAULT_TOKEN_REF),
  toolCallTimeoutMs: z.number().step(1).min(1000).default(120000),
  failOnStartupError: z.boolean().default(false),
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
    legacy(ctx, NETXOPS_SETTINGS_NAMESPACE, Config2, entry, hooks);
    return;
  }
  ctx.inject(["settings"], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, NETXOPS_SETTINGS_NAMESPACE, Config2, entry, hooks);
  });
}
function apply(ctx, config = Config2({})) {
  let source = () => config;
  let mcpFiber;
  let remounting = Promise.resolve();
  let generation = 0;
  if (config.installAgentPreset) {
    ensureAgentPresetInstalled(ctx.logger);
  }
  const remount = () => {
    remounting = remounting.then(async () => {
      const gen = ++generation;
      const previous = mcpFiber;
      mcpFiber = undefined;
      if (previous !== undefined) {
        try {
          await previous.dispose();
        } catch (error) {
          ctx.logger.warn("netxops: disposing previous mcp-client failed: %s", error);
        }
      }
      if (gen !== generation)
        return;
      const current = source();
      const token = await resolveToken(ctx, current.tokenCredentialRef);
      if (gen !== generation)
        return;
      const mcpConfig = McpClient.Config({
        transport: "stdio",
        serverName: "netx",
        command: current.pythonCommand,
        args: ["-m", "netx_mcp"],
        env: {
          NETX_API_URL: current.apiUrl.replace(/\/$/, ""),
          NETX_API_TOKEN: token,
          NETX_LANG: current.lang
        },
        toolCallTimeoutMs: current.toolCallTimeoutMs,
        failOnStartupError: current.failOnStartupError
      });
      try {
        mcpFiber = await ctx.plugin(McpClient, mcpConfig);
      } catch (error) {
        ctx.logger.error("netxops: failed to mount mcp-client: %s", error);
        if (current.failOnStartupError)
          throw error;
      }
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
    const fiber = mcpFiber;
    mcpFiber = undefined;
    fiber?.dispose();
  }, "netxops: dispose mcp-client");
}
export {
  name,
  inject,
  ensureAgentPresetInstalled,
  apply,
  NETXOPS_SETTINGS_NAMESPACE,
  NETXOPS_PRESET_ID,
  DEFAULT_TOKEN_REF,
  Config2 as Config
};
