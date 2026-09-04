# netxops — Netx Ops for DeepSeek Harness

Public **DeepSeek Harness agent preset** for network operations against [netx](https://github.com/hansjone/netx) (ZTE UME alarms, NE inventory, managed read-only CLI).

- GitHub topic: [`dsh-plugin`](https://github.com/topics/dsh-plugin)
- npm package name: `dsh-netxops`
- Brand: **Netx Ops** (not oclaw)

## What you get (v1)

| Piece | Location |
|-------|----------|
| Agent preset | [`presets/netxops/`](presets/netxops/) |
| Persona | `PERSONA.md` + `agent.cordis.yml` |
| Skills | `ops-netx-ume-playbook`, `ops-netx-managed-ne-playbook` |
| Tools | `@deepseek-ai/dsh-mcp-client` → `python -m netx_mcp` (`mcp__netx__*`) |

**Not in v1:** topology canvas MCP, Excel one-shot report plugin, oclaw channels/Admin.

## Quick install

```powershell
git clone https://github.com/hansjone/netxops.git
cd netxops
powershell -File .\scripts\link-preset.ps1
```

Set `NETX_API_URL` if needed, ensure `pip install` of `netx-mcp`, then in DeepSeek Harness pick preset **Netx Ops**.

Full steps: [docs/INSTALL.md](docs/INSTALL.md) · Tool list: [docs/TOOL_MAP.md](docs/TOOL_MAP.md)

## Local debug (DeepSeekHarness checkout)

```powershell
powershell -File .\scripts\link-preset.ps1
# or:
# cd D:\project\DeepSeekHarness
# pnpm dsh web --patch D:\project\chatgpt\netxops\examples\local-debug\patch.cordis.yml
```

See [examples/local-debug/README.md](examples/local-debug/README.md).

## Smoke checks

1. Tools visible: `mcp__netx__aggregateUmeAlarms`, `mcp__netx__queryUmeAlarms`, …
2. “Critical Top by host” → aggregate + Result/Evidence reply shell
3. “Alarms on `<host_name>`” → host-scoped query only

## Related

- Data plane: [hansjone/netx](https://github.com/hansjone/netx)
- Porting from oclaw ops: [docs/PORTING.md](docs/PORTING.md)

## License

MIT
