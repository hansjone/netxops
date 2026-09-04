# netxops — Netx Ops for DeepSeek Harness

Public **DeepSeek Harness** package: host bridge (settings + credentials → netx MCP) and an **ops agent preset** (persona + playbooks).

- GitHub: https://github.com/hansjone/netxops  
- Topic: [`dsh-plugin`](https://github.com/topics/dsh-plugin)  
- npm name: `dsh-netxops`  
- Brand: **Netx Ops**

## What you get

| Piece | Where | Purpose |
|-------|--------|---------|
| Host plugin `dsh-netxops` | `src/index.ts` + `cordis.patch.yml` | `apiUrl` / `lang` in settings; token as credential `NETX_API_TOKEN`; mounts `mcp__netx__*` |
| Agent preset | `presets/netxops/` | Persona + UME / managed-NE skills |

**Not OS env:** do not put `NETX_API_URL` / `NETX_API_TOKEN` in system environment for day-to-day use — configure inside DSH (settings + credentials). See [docs/INSTALL.md](docs/INSTALL.md).

**Not in v1:** topology canvas MCP, Excel report plugin, Plugins settings **card** UI (Host namespace is ready; browser card follows DSH cookbook).

## Quick start

```powershell
# 1) Host bridge + MCP tools
dsh plugin --profile web add github:hansjone/netxops

# 2) Token (credentials store, same family as model keys)
powershell -File .\scripts\set-netx-token.ps1 -Token "nxt_…"

# 3) Ops preset (persona + skills)
powershell -File .\scripts\link-preset.ps1
```

Then open DSH → session preset **Netx Ops**.

## Local debug

Against [`DeepSeekHarness`](https://github.com/deepseek-ai/deepseek-harness) checkout: [examples/local-debug/README.md](examples/local-debug/README.md).

## Related

- Data plane: [hansjone/netx](https://github.com/hansjone/netx)
- Porting from oclaw: [docs/PORTING.md](docs/PORTING.md)

## License

MIT
