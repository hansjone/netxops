# Install Netx Ops on DeepSeek Harness

## Prerequisites

1. **DeepSeek Harness** (`dsh`) installed or a local checkout.
2. **netx API** reachable (default `http://127.0.0.1:8890`).
3. **Python 3.11+** on the same machine as `dsh`, with `netx_mcp` importable:

```powershell
pip install "git+https://github.com/hansjone/netx.git#subdirectory=packages/netx-mcp"
python -c "import netx_mcp; print('ok')"
```

You do **not** need to export `NETX_API_URL` / `NETX_API_TOKEN` in the OS environment for normal use.

## 1) Install host bridge (URL + token + MCP tools)

```bash
dsh plugin --profile <name> add github:hansjone/netxops
# or from a checkout:
dsh plugin --profile <name> add /path/to/netxops
```

This applies `cordis.patch.yml`, which mounts package `dsh-netxops`. That plugin:

- Registers settings namespace **`netxops`** (`apiUrl`, `lang`, `pythonCommand`, …)
- Reads bearer token from credentials reference **`NETX_API_TOKEN`** (same store as model keys: `~/.dsh/.credentials.yaml`)
- Spawns `python -m netx_mcp` and registers `mcp__netx__*` on the **host** tool registry

### Fill API URL / language

**Target UX:** Settings → **Plugins** → **Netx Ops** card (settings `apiUrl` / `lang`).  
The Host settings namespace is already registered; a dedicated Plugins settings card (browser half) follows the [DSH settings-card cookbook](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-settings-card.md) and will land in a follow-up.

**Until the card ships**, change composition defaults in the profile patch / plugin config:

```yaml
# ~/.dsh/profiles/<name>/… or override the dsh-netxops row
config:
  apiUrl: http://10.0.0.5:8890
  lang: zh
  pythonCommand: python
```

Or edit the installed bundle row after `dsh plugin add`.

### Fill netx API token (secret)

Same credential store as DeepSeek API keys — **not** a process env var:

```powershell
powershell -File .\scripts\set-netx-token.ps1 -Token "nxt_…"
```

```bash
./scripts/set-netx-token.sh 'nxt_…'
```

This writes / updates `refs.NETX_API_TOKEN` under `%USERPROFILE%\.dsh\.credentials.yaml` (or `$DSH_HOME`). Restart is not required if DSH is watching credentials; otherwise restart `dsh web`.

## 2) Install the agent preset (persona + skills)

```powershell
git clone https://github.com/hansjone/netxops.git
cd netxops
powershell -File .\scripts\link-preset.ps1
```

Unix: `./scripts/link-preset.sh`

Open `dsh web`, new session → preset **Netx Ops**.

## Verify

1. Tools include `mcp__netx__queryUmeAlarms` (and siblings).
2. “Critical Top by host” → aggregate + Result/Evidence shell.
3. Single `host_name` alarm query → host-scoped tools only.

See [TOOL_MAP.md](TOOL_MAP.md).

## Local debug (DeepSeekHarness checkout)

See [examples/local-debug/README.md](../examples/local-debug/README.md).
