# Install Netx Ops on DeepSeek Harness

## What `dsh plugin add` gives you

One install wires **all of**:

| Piece | How you use it |
|-------|----------------|
| Host tools | Capability groups **ops / topology / biz-monitor**. Each group targets Netx Ops, selected other presets, or all presets; tools and skills share the policy. A master switch revokes all Netx publication. Defaults: ops+bizMonitor in Netx Ops, all public off. |
| Companion plugins | **dsh-im-ops** + **dsh-ops-cron** — add as **direct** profile deps in the same command (DSH/pnpm blocks `github:` as transitive deps) |
| Plugins card | Settings → Plugins → **Netx Ops** (URL / API lang / thinking+reply language / token / capability groups) |
| Agent preset + skills | Settings → Agent presets → **Netx Ops**. Host composes from **this host's** shipped **standard** + Netx Ops overlays (no preset inheritance). DSH ≥0.2 (Desktop **and** web) uses declarative `@deepseek-ai/dsh-agent-preset` rows synced into that profile's `cordis.patch.yml` (from `@deepseek-ai/dsh-web-app/presets/standard.patch.yml`). A directory under `~/.dsh/.agent-presets/netxops` is still written for older hosts, but 0.2 no longer lists it. Restart Desktop / `dsh web` once after upgrade. Playbooks follow the same group toggles |

You do **not** run `link-preset.ps1` for normal use. That script is only a manual fallback.

## Still required outside the npm package

1. **netx API** reachable (default `http://127.0.0.1:8890`) — the data plane.
2. **API token** with scopes matching the tools you use (`alarms:read`, `ne:read`, `ne:exec`, `biz-monitor:read`, `sql:query`, …).

No local Python / `netx_mcp` install is required for DSH. (OpenClaw and other MCP hosts can still use `python -m netx_mcp` separately for NMS/CLI — **not** for biz-monitor; that is netxops host tools only.)

## Clone / `pnpm install`（仓库源码）

`@deepseek-ai/*` 由 **DSH Host profile** 提供，**不**声明为可从公共 registry 安装的依赖。仓库根目录 `pnpm install` 只会装公开包（如 `fflate`）。完整运行请用上面的 `dsh plugin add`，不要指望裸 clone 能从 npm 拉齐 Harness 内部包。

## Desktop 本地开发（`link:` 路径安装）

Desktop「添加插件」填本地目录时，会写成 `link:D:/…/netxops`。Node 从**工作区真实路径**解析 `@deepseek-ai/*`，不会走到 Desktop profile 的 `node_modules`，于是 Host 行报 `Cannot find package '@deepseek-ai/schemastery'`，插件页显示 **netxops 未运行**（预设行可能仍正常）。

装完本地路径后在仓库根执行一次（把 Host 的 `@deepseek-ai/*` peer junction 进本仓库 `node_modules`）：

```powershell
bun run link:peers
# 或 PowerShell: .\scripts\link-dsh-peers.ps1
```

脚本优先从 `~/.dsh/profiles/node_modules` 选择一整套 peers；该目录不完整时才考虑 profile 的完整依赖集。不要单独替换某个内部包版本，混链可能使 Config 或服务上下文不兼容。

然后**重启 Desktop**（或在插件页关掉再启用 dsh-netxops）。症状对照：

| 现象 | 原因 |
|------|------|
| `Cannot find package '@deepseek-ai/schemastery'` / **netxops 未运行** | 未跑 `link:peers` |
| **web boot: dsh-netxops failed** | 检查具体加载错误；若 peers 混链，重跑 `bun run link:peers` 后重启 |
| `pending (waiting for service: settingsScope)` → 会话无 `netx__*` / 无 `netx-ops` | 旧客户端仍硬/软等待已删除的 `settingsScope`（DSH 0.2）；用 **≥0.1.55** 的 tgz 重装并完全重启 Desktop，勿用脏的 `link:` / 混锁 `.modules.yaml` |
| Desktop 卡在 **Loading plugins…** / 设置页无 Netx Ops | 旧客户端 `immediately: true` 或同步 `inject(['configForms'])`；用 **≥0.1.55**（`immediately: false` + deferred poll） |
| 无 live connection，预设内无 `netx__*` | 检查 Host 插件是否启用及其加载错误。缺少 Host 时现在停止发布，不再通过预设入口自动补回被关闭的插件。 |

改 Host/Client 后照常 `bun run bundle`，一般不用重装；换机器或清过本仓库 `node_modules` 才需再 `link:peers`。

备选：`npm pack` 后在 Desktop「添加插件」填 **`.tgz` 绝对路径**（复制进 profile，不走 `link:`，也就不用 link peers）。

当前实现：第三方运行时依赖（含 `fflate`）已打进 `lib/`；六个 agent-tools 入口为自包含包。Host 启动即发布实际策略，凭据软注入并异步补齐。缺少 Host 连接桥接时，预设入口保持关闭。

插件卡使用 `settings.section` 和官方 `settings.plugin.item`，配合 deferred `configForms`。能力组支持指定其他预设、全预设公开及总开关。详情见 [工具发布与 UI 修复说明](PUBLICATION-REVIEW.zh.md)。

## Install

```powershell
dsh plugin --profile web add `
  github:hansjone/netxops `
  github:hansjone/dsh-im-ops `
  github:hansjone/dsh-ops-cron
# or from DeepSeekHarness source:
# pnpm dsh plugin --profile web add github:hansjone/netxops github:hansjone/dsh-im-ops github:hansjone/dsh-ops-cron
dsh web   # or: pnpm dsh web
```

One command, three **direct** profile bundles. Do **not** nest IM/cron under netxops — profile pnpm enables `blockExoticSubdeps`, so `github:` subdependencies fail with `ERR_PNPM_EXOTIC_SUBDEP`. If pnpm blocks a git `prepare` script, allowlist the printed package keys under `allowBuilds` in the profile’s `pnpm-workspace.yaml`, then re-run.

1. **Settings → Plugins → Netx Ops** → API URL (+ token if the field is enabled).  
   Token fallback: `scripts/set-netx-token.ps1` / `.sh`.  
   Optional: enable **关键告警推送** so this DSH dials `ws(s)://<apiUrl>/v1/integrations/dsh-alarm/ws`. Choose **投递到 DSH 会话** and/or **投递到 WhatsApp / IM**. For IM, install `dsh-im-ops`, create a delivery target, then paste `imBotId` / `imTargetId`. The card header shows live WSS status.  
   Optional: **导出全部会话** downloads `dsh-sessions-<host>-<utc>.zip` via `GET /api/netxops.sessions.export` (browser download; works for cloud Hosts).  
   Capability groups: **ops + biz-monitor** default on in Netx Ops only. Use **指定其他预设** for selective publication or **对所有预设公开** for Host-wide publication. The master switch revokes all Netx tools and skills while keeping selections. These toggles auto-save and affect the next model request without a restart.
   Optional: **知识库** — set package root (MANIFEST v1.0); default mounts `_skills/kb-*` into Netx Ops; optional public. See [KNOWLEDGE_BASE.md](KNOWLEDGE_BASE.md).
2. Restart after install/upgrade so the bundle patch layers apply. Open Settings → **Agent presets** → **Netx Ops** should appear.
   The Netx Ops preset is **standard + netxops tools/persona** (shell, search, plan, todo, web, workflows, … plus `netx__*`). Re-activate (or restart the Host) so `$DSH_HOME/.agent-presets/netxops` is recomposed from the current Harness `standard` preset.
3. **New session → preset Netx Ops** → ask e.g. Critical Top / single-host alarms / 「能否登录」.

## Key-alarm push

- **netx** (fixed IP) hosts the subscribe hub and fans out matched key alerts.
- **netxops** (each DSH) reuses the same URL/token, connects outbound, and delivers into a DSH session and/or IM via `ctx.dshIm.send`.
- Live status is exposed on the Plugins card via Connection RPC (`/netxops` → `alarm-push.status`); no curl required for day-to-day checks.
- WhatsApp / `dsh-im` is **optional** for the DSH session path; required only when IM delivery is checked.

## Export all sessions (HQ pickup)

- **Where:** Settings → Plugins → **Netx Ops** → **导出全部会话**.
- **What:** browser downloads one ZIP — `manifest.json` plus `sessions/<id>/session.jsonl` from this Host’s `sessionPersistence`.
- **Why:** each edge / cloud harness keeps its own sessions; Ops downloads from the Web UI and ships archives to HQ.
- **Limits:** needs a JSONL (raw-artifact) persistence backend; SQLite backends refuse export.

## Verify

1. Plugins card **Netx Ops** visible.
2. With key-alarm push on: card badge shows **Connected** (or reconnecting / auth failed with detail).
3. Agent presets → Custom → **Netx Ops**.
4. Tools include `netx__queryNmsAlarms` / `netx__execManagedNe` / `netx__findTopologyPaths` (**ops** → skill `netx-ops`). Cutover analysis: `netx__getBizMonitorContext` … (**bizMonitor** → `netx-biz-monitor`). Native canvas tools need **topology** (`netx-topology`); advanced dual-unit/orbit/polish requires the separate topology MCP.
5. Export section shows a session count; **下载 ZIP** starts a browser download.
6. Optional knowledge-base badge shows operator/country/version when `kbRoot` + MANIFEST are valid.

See [TOOL_MAP.md](TOOL_MAP.md) and [KNOWLEDGE_BASE.md](KNOWLEDGE_BASE.md).

## Path / local checkout (developers)

```powershell
dsh plugin --profile web add D:\path\to\netxops
powershell -File .\scripts\link-dsh-peers.ps1   # only for path/link: installs
```

See [examples/local-debug/README.md](../examples/local-debug/README.md).
