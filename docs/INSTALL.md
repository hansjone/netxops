# Install Netx Ops on DeepSeek Harness

## Prerequisites

1. **DeepSeek Harness** (`dsh`) installed.
2. **netx API** reachable (default `http://127.0.0.1:8890`).
3. **Python 3.11+** with `netx_mcp` importable:

```powershell
pip install "git+https://github.com/hansjone/netx.git#subdirectory=packages/netx-mcp"
python -c "import netx_mcp; print('ok')"
```

No OS env vars needed for URL / token.

## Install (GitHub — recommended)

```powershell
dsh plugin --profile web add github:hansjone/netxops
dsh web
```

Then: **Settings → Plugins → Netx Ops** → paste API token + URL → Save.

That is the whole host install. You do **not** run any `link-dsh-peers` script for GitHub installs.

### Agent preset (persona + skills)

One-time (or after pull):

```powershell
git clone https://github.com/hansjone/netxops.git
cd netxops
powershell -File .\scripts\link-preset.ps1
```

Unix: `./scripts/link-preset.sh`

New session → preset **Netx Ops**.

## Verify

1. Settings → Plugins shows **Netx Ops**; token badge “Configured” after save.
2. Tools include `mcp__netx__queryUmeAlarms`.
3. Critical Top / single-host alarm queries work.

See [TOOL_MAP.md](TOOL_MAP.md).

## Path / local checkout (developers only)

```powershell
dsh plugin --profile web add D:\path\to\netxops
powershell -File .\scripts\link-dsh-peers.ps1   # only for path/link: installs
```

See [examples/local-debug/README.md](../examples/local-debug/README.md).
