# Netx Ops tool map

Tools register by capability group. **One group ↔ one skill.**

| Group | Skill | Default in Ops preset |
|-------|-------|------------------------|
| **ops** | `netx-ops` | on |
| **topology** | `netx-topology` | off |

Public flags mount the same group on the host for other presets.
Forced mounts: `dsh-netxops/tools-ops` | `tools-topology` (legacy aliases: `tools-nms` / `tools-common` → ops).

Model names: `netx__<stem>`. NMS tools use `Nms`; adapter `nmsProvider=zte-ume` still hits `/v1/ume/*`.

## ops → `netx-ops`

| Tool | Role |
|------|------|
| `queryNmsAlarms` … `sqlQueryNms` | Alarm + inventory + SQL |
| `listManagedNe` / `getManagedNe` / `execManagedNe` / `listCliTargets` | Managed CLI (login / show) |
| `findTopologyPaths` | Fabric path lookup |

## topology → `netx-topology`

| Tool | Role |
|------|------|
| Tree / view / folders / membership / neighbors | Canvas CRUD |
| Fabric query / classify / edges | Inventory + adjacency |
| `layoutTopologyView` | move_nodes / catalog / … |
| `suggestSinkHubs` / `analyzeTopologyViewLayout` / `sinkTopologyDualUnits` | Dual-unit / QA (may stub → MCP layout engine) |

Canonical skill bodies: sibling **`netx/skills/`**. DSH loads them at runtime (`NETX_SKILLS_ROOT` or `../netx/skills`) or from `presets/netxops/skills` after sync.

Execution: HTTP `apiUrl` + Bearer `NETX_API_TOKEN`.
