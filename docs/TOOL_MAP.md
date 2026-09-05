# Netx Ops tool map

Tools register by capability group. **One group ↔ one skill.**

| Group | Skill | Default in Ops preset |
|-------|-------|------------------------|
| **nms** | `netx-nms` | on |
| **common** | `netx-common` | on |
| **topology** | `netx-topology` | off |

Public flags mount the same group on the host for other presets.
Forced mounts: `dsh-netxops/tools-nms` | `tools-common` | `tools-topology`.

Model names: `netx__<stem>`. NMS tools use `Nms`; adapter `nmsProvider=zte-ume` still hits `/v1/ume/*`.

## nms → `netx-nms`

| Tool | Role |
|------|------|
| `queryNmsAlarms` … `sqlQueryNms` | Alarm + inventory + SQL |

## common → `netx-common`

| Tool | Role |
|------|------|
| `listManagedNe` / `getManagedNe` / `execManagedNe` / `listCliTargets` | Managed CLI |
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
