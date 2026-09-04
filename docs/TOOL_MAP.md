# Netx MCP tool map (v1)

Tools are registered by `@deepseek-ai/dsh-mcp-client` with `serverName: netx`.

Model-facing name: `mcp__netx__<tool>`.

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

stdio entry: `python -m netx_mcp` → HTTP `NETX_API_URL`.

Upstream package: [netx `packages/netx-mcp`](https://github.com/hansjone/netx/tree/main/packages/netx-mcp).

**Out of v1:** `netx-topology` MCP / topology canvas skills.
