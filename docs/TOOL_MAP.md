# Netx Ops tool map

Tools are registered by the Ops agent preset (`dsh-netxops/tools`) into that preset's tool scope — not the host global layer — so other agent presets do not see them.

Model-facing name: `netx__<tool>`.

| Tool | Role |
|------|------|
| `queryUmeAlarms` | Paged current alarms |
| `aggregateUmeAlarms` | Severity / Top NE aggregate |
| `runUmeDiagnostics` | Diagnostics + freshness meta |
| `queryUmeNeInventory` | UME NE list |
| `getUmeNe` | Single UME NE detail |
| `queryUmeAlarmsRaw` | Raw / evidence fields |
| `aggregateUmeAlarmsRaw` | Dynamic group_by |
| `listUmeAlarmFields` | Field catalog |
| `sqlQueryUme` | Read-only SELECT |
| `findTopologyPaths` | Shortest path between UME NEs (path query only; no canvas layout in v1) |
| `listManagedNe` | Managed device list |
| `getManagedNe` | Managed device detail |
| `execManagedNe` | Read-only CLI (batch-first) |
| `listCliTargets` | CLI target index (managed + ume) |

Execution: browser/`fetch` from the DSH host → HTTP `apiUrl` + Bearer `NETX_API_TOKEN`.

Handler/paths mirror [netx `packages/netx-mcp`](https://github.com/hansjone/netx/tree/main/packages/netx-mcp) (`http_tools.py` / `http_client.py`).

**Out of v1:** `netx-topology` MCP / topology canvas skills.
