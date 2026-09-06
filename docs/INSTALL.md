# Install Netx Ops on DeepSeek Harness

## What `dsh plugin add` gives you

One install wires **all of**:

| Piece | How you use it |
|-------|----------------|
| Host tools | Capability groups **ops / topology** (one group ↔ one skill). Default ops in Ops preset; topology and all public off. Other agents may mount `dsh-netxops/tools-ops|topology` |
| Companion plugins | **dsh-im-ops** + **dsh-ops-cron** — add as **direct** profile deps in the same command (DSH/pnpm blocks `github:` as transitive deps) |
| Plugins card | Settings → Plugins → **Netx Ops** (URL / lang / token / capability groups) |
| Agent preset + skills | Settings → Agent presets → **Custom → Netx Ops** (copied into `~/.dsh/.agent-presets` on first boot); playbooks follow the same group toggles |

You do **not** run `link-preset.ps1` for normal use. That script is only a manual fallback.

## Still required outside the npm package

1. **netx API** reachable (default `http://127.0.0.1:8890`) — the data plane.
2. **API token** with scopes matching the tools you use (`alarms:read`, `ne:read`, `ne:exec`, `sql:query`, …).

No local Python / `netx_mcp` install is required for DSH. (OpenClaw and other MCP hosts can still use `python -m netx_mcp` separately.)

## Clone / `pnpm install`（仓库源码）

`@deepseek-ai/*` 由 **DSH Host profile** 提供，**不**声明为可从公共 registry 安装的依赖。仓库根目录 `pnpm install` 只会装公开包（如 `fflate`）。完整运行请用上面的 `dsh plugin add`，不要指望裸 clone 能从 npm 拉齐 Harness 内部包。

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
   Capability groups: leave default for **ops**, or enable **topology** / **对其他预设公开** (new sessions after save).
2. Restart or open Settings → **Agent presets** → Custom → **Netx Ops** should appear after the host plugin has activated once.
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
4. Tools include `netx__queryNmsAlarms` / `netx__execManagedNe` / `netx__findTopologyPaths` (**ops** → skill `netx-ops`). Canvas / dual_unit need **topology** (`netx-topology`).
5. Export section shows a session count; **下载 ZIP** starts a browser download.

See [TOOL_MAP.md](TOOL_MAP.md).

## Path / local checkout (developers)

```powershell
dsh plugin --profile web add D:\path\to\netxops
powershell -File .\scripts\link-dsh-peers.ps1   # only for path/link: installs
```

See [examples/local-debug/README.md](../examples/local-debug/README.md).
