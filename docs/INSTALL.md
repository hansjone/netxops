# Install Netx Ops on DeepSeek Harness

## What `dsh plugin add` gives you

One install wires **all of**:

| Piece | How you use it |
|-------|----------------|
| Host bridge | spawns `mcp__netx__*` via `python -m netx_mcp` |
| Plugins card | Settings → Plugins → **Netx Ops** (URL / lang / python) |
| Agent preset + skills | Settings → Agent presets → **Custom → Netx Ops** (copied into `~/.dsh/.agent-presets` on first boot) |

You do **not** run `link-preset.ps1` for normal use. That script is only a manual fallback.

## Still required outside the npm package

1. **netx API** reachable (default `http://127.0.0.1:8890`) — the data plane.
2. **Python `netx_mcp`** on the same machine as `dsh`:

```powershell
pip install "git+https://github.com/hansjone/netx.git#subdirectory=packages/netx-mcp"
python -c "import netx_mcp; print('ok')"
```

v1 keeps the Python MCP as the execution plane (shared with OpenClaw / `python -m netx_mcp`). The DSH plugin owns orchestration, settings, persona, and skills — not a second MCP install in the agent preset.

## Install

```powershell
dsh plugin --profile web add github:hansjone/netxops
# or from DeepSeekHarness source:
# pnpm dsh plugin --profile web add github:hansjone/netxops
dsh web   # or: pnpm dsh web
```

1. **Settings → Plugins → Netx Ops** → API URL (+ token if the field is enabled).  
   Token fallback: `scripts/set-netx-token.ps1` / `.sh`.
2. Restart or open Settings → **Agent presets** → Custom → **Netx Ops** should appear after the host plugin has activated once.
3. **New session → preset Netx Ops** → ask e.g. Critical Top / single-host alarms.

## Verify

1. Plugins card **Netx Ops** visible.
2. Agent presets → Custom → **Netx Ops**.
3. Tools include `mcp__netx__queryUmeAlarms`.

See [TOOL_MAP.md](TOOL_MAP.md).

## Path / local checkout (developers)

```powershell
dsh plugin --profile web add D:\path\to\netxops
powershell -File .\scripts\link-dsh-peers.ps1   # only for path/link: installs
```

See [examples/local-debug/README.md](../examples/local-debug/README.md).
