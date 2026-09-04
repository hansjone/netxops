# Install Netx Ops on DeepSeek Harness

## Prerequisites

1. **DeepSeek Harness** (`dsh`) installed or a local checkout (see [local debug](../examples/local-debug/README.md)).
2. **netx API** reachable (default `http://127.0.0.1:8890`).
3. **Python 3.11+** on the same machine as `dsh`, with `netx_mcp` importable:

```powershell
pip install "git+https://github.com/hansjone/netx.git#subdirectory=packages/netx-mcp"
python -c "import netx_mcp; print('ok')"
```

4. Environment (optional if defaults match):

| Variable | Default | Purpose |
|----------|---------|---------|
| `NETX_API_URL` | `http://127.0.0.1:8890` | netx REST root |
| `NETX_API_TOKEN` | (empty / auto file) | Bearer token |
| `NETX_LANG` | `zh` | API locale |

## Install the agent preset (recommended)

Clone this repo, then link or copy the preset directory into the DSH user preset root:

```powershell
git clone https://github.com/hansjone/netxops.git
# Windows (developer junction — editable in place):
powershell -File .\scripts\link-preset.ps1
# Or copy:
#   Copy-Item -Recurse .\presets\netxops $env:USERPROFILE\.dsh\.agent-presets\netxops
```

Unix:

```bash
git clone https://github.com/hansjone/netxops.git
./scripts/link-preset.sh
# Or: cp -R presets/netxops ~/.dsh/.agent-presets/netxops
```

Restart / open `dsh web`, create a session, choose preset **Netx Ops** (`netxops`).

## Optional: `dsh plugin add`

```bash
dsh plugin --profile <name> add github:hansjone/netxops
```

v1’s host `cordis.patch.yml` is empty (MCP stays inside the preset). You still need the preset link/copy above.

## Verify

1. Session tools include `mcp__netx__queryUmeAlarms` (and siblings).
2. Ask: “Critical Top 10 by host” → expect `aggregateUmeAlarms` + Result/Evidence shell.
3. Ask a single `host_name` alarm query → host-scoped tools only.

See [TOOL_MAP.md](TOOL_MAP.md).
