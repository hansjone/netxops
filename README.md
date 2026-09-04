# netxops — Netx Ops for DeepSeek Harness

Public **DeepSeek Harness** package: host bridge + **Plugins settings card** + ops agent preset.

- GitHub: https://github.com/hansjone/netxops  
- Topic: [`dsh-plugin`](https://github.com/topics/dsh-plugin)  
- Package: `dsh-netxops`  
- Brand: **Netx Ops**

## What you get

| Piece | Where | Purpose |
|-------|--------|---------|
| Host plugin | `src/index.ts` + `cordis.patch.yml` | settings `netxops` + credential `NETX_API_TOKEN` → `mcp__netx__*` |
| Plugins card | `src/client/` → `lib/client.js` | Settings → Plugins → fill URL / token in UI |
| Agent preset | `presets/netxops/` | Persona + UME / managed-NE skills |

**No OS env required** for day-to-day use. See [docs/INSTALL.md](docs/INSTALL.md).

**Not in v1:** topology canvas MCP, Excel report plugin.

## Quick start

```powershell
dsh plugin --profile web add github:hansjone/netxops
dsh web
# Settings → Plugins → Netx Ops → token + API URL → Save
```

Agent preset (skills): clone once and run `scripts/link-preset.ps1` (or `.sh`).

## Related

- Data plane: [hansjone/netx](https://github.com/hansjone/netx)
- Porting: [docs/PORTING.md](docs/PORTING.md)

## License

MIT
