# netxops — Netx Ops for DeepSeek Harness

Public **DeepSeek Harness** package: native `netx__*` REST tools + Plugins card + **agent preset (skills included)**.

- GitHub: https://github.com/hansjone/netxops  
- Package: `dsh-netxops`  
- Brand: **Netx Ops**

## Install (one command)

```powershell
dsh plugin --profile web add github:hansjone/netxops
dsh web
```

Then:

1. Settings → **Plugins** → **Netx Ops** → API URL / token  
2. Optional: enable **关键告警推送** — DSH dials out to netx and opens a sticky session on matched key alarms (WhatsApp / im not required). The card shows live WSS status (Connected / Reconnecting / Auth failed).  
3. Settings → **Agent presets** → Custom → **Netx Ops** (installed automatically on first host activate)  
4. New session → choose **Netx Ops**

Also need: a reachable **netx API** (no local `pip install netx_mcp`). Details: [docs/INSTALL.md](docs/INSTALL.md).

## What is coupled

| In the plugin | Outside (data / runtime) |
|---------------|---------------------------|
| `netx__*` REST tools (Ops preset only) + settings + credentials | netx HTTP API (URL + token) |
| Optional key-alarm push (WSS client → sticky DSH session) | netx `/v1/integrations/dsh-alarm/ws` hub |
| Persona + UME / managed-NE skills | |
| Agent preset auto-install to `~/.dsh/.agent-presets` | |

MCP (`python -m netx_mcp`) remains available for OpenClaw / other hosts — not required for DSH.

## License

MIT
