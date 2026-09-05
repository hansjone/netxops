# Install Netx Ops on DeepSeek Harness

## What `dsh plugin add` gives you

One install wires **all of**:

| Piece | How you use it |
|-------|----------------|
| Host tools | Ops-preset-scoped `netx__*` → netx REST (Bearer token); other presets do not see them |
| Plugins card | Settings → Plugins → **Netx Ops** (URL / lang / token) |
| Agent preset + skills | Settings → Agent presets → **Custom → Netx Ops** (copied into `~/.dsh/.agent-presets` on first boot) |

You do **not** run `link-preset.ps1` for normal use. That script is only a manual fallback.

## Still required outside the npm package

1. **netx API** reachable (default `http://127.0.0.1:8890`) — the data plane.
2. **API token** with scopes matching the tools you use (`alarms:read`, `ne:read`, `ne:exec`, `sql:query`, …).

No local Python / `netx_mcp` install is required for DSH. (OpenClaw and other MCP hosts can still use `python -m netx_mcp` separately.)

## Install

```powershell
dsh plugin --profile web add github:hansjone/netxops
# or from DeepSeekHarness source:
# pnpm dsh plugin --profile web add github:hansjone/netxops
dsh web   # or: pnpm dsh web
```

1. **Settings → Plugins → Netx Ops** → API URL (+ token if the field is enabled).  
   Token fallback: `scripts/set-netx-token.ps1` / `.sh`.  
   Optional: enable **关键告警推送** so this DSH dials `ws(s)://<apiUrl>/v1/integrations/dsh-alarm/ws`. Choose **投递到 DSH 会话** and/or **投递到 WhatsApp / IM**. For IM, install `dsh-im-ops`, create a delivery target, then paste `imBotId` / `imTargetId`. The card header shows live WSS status.
2. Restart or open Settings → **Agent presets** → Custom → **Netx Ops** should appear after the host plugin has activated once.
3. **New session → preset Netx Ops** → ask e.g. Critical Top / single-host alarms.

## Key-alarm push

- **netx** (fixed IP) hosts the subscribe hub and fans out matched key alerts.
- **netxops** (each DSH) reuses the same URL/token, connects outbound, and delivers into a DSH session and/or IM via `ctx.dshIm.send`.
- Live status is exposed on the Plugins card via Connection RPC (`/netxops` → `alarm-push.status`); no curl required for day-to-day checks.
- WhatsApp / `dsh-im` is **optional** for the DSH session path; required only when IM delivery is checked.

## Verify

1. Plugins card **Netx Ops** visible.
2. With key-alarm push on: card badge shows **Connected** (or reconnecting / auth failed with detail).
3. Agent presets → Custom → **Netx Ops**.
4. Tools include `netx__queryUmeAlarms`.

See [TOOL_MAP.md](TOOL_MAP.md).

## Path / local checkout (developers)

```powershell
dsh plugin --profile web add D:\path\to\netxops
powershell -File .\scripts\link-dsh-peers.ps1   # only for path/link: installs
```

See [examples/local-debug/README.md](../examples/local-debug/README.md).
