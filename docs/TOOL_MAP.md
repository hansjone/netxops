# Netx Ops tool map

Tools register by capability group. **One group ↔ one skill.**

| Group | Skill | Default in Ops preset |
|-------|-------|------------------------|
| **ops** | `netx-ops` | on |
| **topology** | `netx-topology` | off |
| **bizMonitor** | `netx-biz-monitor` | on |

Public flags mount the same group on the host for other presets.
Forced mounts: `dsh-netxops/tools-ops` | `tools-topology` | `tools-biz-monitor` (legacy aliases: `tools-nms` / `tools-common` → ops).

Model names: `netx__<stem>`. NMS tools use `Nms`; adapter `nmsProvider=zte-ume` still hits `/v1/ume/*`.

## ops → `netx-ops`

| Tool | Role |
|------|------|
| `queryNmsAlarms` … `sqlQueryNms` | Alarm + inventory + SQL |
| `listManagedNe` / `getManagedNe` / `execManagedNe` / `listCliTargets` | Managed CLI (login / show) |
| `findTopologyPaths` | Fabric path lookup |

## bizMonitor → `netx-biz-monitor`

Host tools call netx REST directly (**not** netx-mcp). Token needs `biz-monitor:read`.

| Tool | Role |
|------|------|
| `getBizMonitorContext` | Project + templates + normalize + port map + tasks |
| `getBizMonitorBoard` | Batch / evaluate progress |
| `listBizMonitorReds` / `getBizMonitorDiffs` | Reds & diffs with evidence (raw A/B + show cmd) |
| `getBizCollectBatch` / `getBizCollectCommandRaw` | Collect audit + full CLI raw |

## topology → `netx-topology`

| Tool | Role |
|------|------|
| Tree / view / folders / membership / neighbors | Canvas CRUD |
| Fabric query / classify / edges | Inventory + adjacency |
| `layoutTopologyView` | move_nodes / catalog / … |
| `suggestSinkHubs` / `analyzeTopologyViewLayout` / `sinkTopologyDualUnits` | Dual-unit / QA (may stub → MCP layout engine) |

Canonical skill bodies: sibling **`netx/skills/`**. DSH loads them at runtime (`NETX_SKILLS_ROOT` or `../netx/skills`) or from `presets/netxops/skills` after sync.

Execution: HTTP `apiUrl` + Bearer `NETX_API_TOKEN`.

## knowledge base → `groupKb*` (not ops/topology)

Registered when KB is configured, MANIFEST has `paths.local`, and the KB in-preset / public toggle is on. Host-side FS writes (bypass workspace sandbox). Jail: `{kbLocal}/refs|memories|drafts|suggestions`.

| Tool | Role |
|------|------|
| `kbWriteRef` | Site product KB under `refs/{inventory\|devices\|topology\|business\|commands\|handbooks}/`. `devices` requires `device=host_name`; primary profile slug=`PROFILE`. |
| `kbWriteMemory` | Diary under `memories/{日常笔记\|排障复盘\|AI思维链}/` — write as soon as reusable experience appears. |
| `kbWriteDraft` | New `DRAFT-…` under `drafts/` (+ `status: draft`) |
| `kbWriteSuggestion` | New file under `suggestions/{theory\|improvement}/` |
| `kbUpdateLocal` | Replace body of an existing jailed file |
| `kbDeleteLocal` | Delete one jailed file |
| `kbListLocal` | List recent `.md` under writable trees (`root` may be `refs`) |
