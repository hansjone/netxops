# netxops — Netx Ops for DeepSeek Harness

Public **DeepSeek Harness** package: host bridge + Plugins card + **agent preset (skills included)**.

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
2. Settings → **Agent presets** → Custom → **Netx Ops** (installed automatically on first host activate)  
3. New session → choose **Netx Ops**

Also need: running **netx API**, and `pip install` of `netx_mcp` (Python execution plane). Details: [docs/INSTALL.md](docs/INSTALL.md).

## What is coupled

| In the plugin | Outside (data / runtime) |
|---------------|---------------------------|
| MCP spawn + settings + credentials | netx HTTP API |
| Persona + UME / managed-NE skills | `python -m netx_mcp` on PATH |
| Agent preset auto-install to `~/.dsh/.agent-presets` | |

## License

MIT
