// src/index.ts
import z from "@deepseek-ai/schemastery";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import * as DshSettings from "@deepseek-ai/dsh-settings";
import * as McpClient from "@deepseek-ai/dsh-mcp-client";
var name = "netxops";
var inject = ["tools"];
var NETXOPS_SETTINGS_NAMESPACE = "netxops";
var DEFAULT_TOKEN_REF = "NETX_API_TOKEN";
var Config2 = z.object({
  apiUrl: z.string().default("http://127.0.0.1:8890"),
  lang: z.string().default("zh"),
  pythonCommand: z.string().default("python"),
  tokenCredentialRef: z.string().role("credential-ref").default(DEFAULT_TOKEN_REF),
  toolCallTimeoutMs: z.number().step(1).min(1000).default(120000),
  failOnStartupError: z.boolean().default(false)
});
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
  apply,
  NETXOPS_SETTINGS_NAMESPACE,
  DEFAULT_TOKEN_REF,
  Config2 as Config
};
