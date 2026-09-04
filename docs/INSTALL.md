# Install Netx Ops on DeepSeek Harness

## Prerequisites

1. **DeepSeek Harness** (`dsh`) installed or a local checkout.
2. **netx API** reachable (default `http://127.0.0.1:8890`).
3. **Python 3.11+** on the same machine as `dsh`, with `netx_mcp` importable:

```powershell
pip install "git+https://github.com/hansjone/netx.git#subdirectory=packages/netx-mcp"
python -c "import netx_mcp; print('ok')"
```

You do **not** need OS environment variables for `NETX_API_URL` / `NETX_API_TOKEN`.

## 1) Install host bridge + Plugins settings card

```bash
dsh plugin --profile <name> add github:hansjone/netxops
# or from a checkout:
dsh plugin --profile <name> add /path/to/netxops
```

This mounts `dsh-netxops` (host + browser halves):

- Host: settings namespace **`netxops`**, credential **`NETX_API_TOKEN`**, spawns `mcp__netx__*`
- Browser: **Settings → Plugins → Netx Ops** card (API URL / lang / python + token)

### Fill in the UI (recommended)

1. Open `dsh web` → **Settings** → **Plugins** → **Plugin configuration**
2. Expand **Netx Ops**
3. Paste **API token** (stored as credential `NETX_API_TOKEN`, never in settings JSON)
4. Set **API URL** (e.g. `http://127.0.0.1:8890`), optional lang / python command
5. **Save** — MCP remounts with the new values

### Optional CLI for token only

```powershell
powershell -File .\scripts\set-netx-token.ps1 -Token "nxt_…"
```

## 2) Install the agent preset (persona + skills)

```powershell
git clone https://github.com/hansjone/netxops.git
cd netxops
powershell -File .\scripts\link-preset.ps1
```

Unix: `./scripts/link-preset.sh`

Open `dsh web`, new session → preset **Netx Ops**.

## Verify

1. Settings → Plugins shows **Netx Ops** card; token badge becomes “Configured” after save.
2. Tools include `mcp__netx__queryUmeAlarms` (and siblings).
3. “Critical Top by host” / single `host_name` alarm query work.

See [TOOL_MAP.md](TOOL_MAP.md).

## Local debug (DeepSeekHarness checkout)

See [examples/local-debug/README.md](../examples/local-debug/README.md).

Rebuild the Plugins card after editing `src/client/`:

```powershell
bun run bundle
```
