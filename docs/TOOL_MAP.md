# Netx Ops tool map

Tools are discovered from netx **`/mcp`** (`tools/list`) and registered into DSH as `netx__<stem>`.

**One group ↔ one skill.** Group membership comes from `_meta.netx.group` on each MCP tool — there is no hardcoded catalog in the plugin.

| Group | Skill | Default in Ops preset |
|-------|-------|------------------------|
| **ops** | `netx-ops` | on |
| **topology** | `netx-topology` | off |
| **bizMonitor** | `netx-biz-monitor` | on |

## Visibility switches (UX only — not a security boundary)

- **Group inPreset / public** — register the whole group (or not).
- **`disabledTools`** — opt-out list of **server** tool names; unlisted tools follow the group.
- **`readOnlyOnly`** — drop tools whose `annotations.readOnlyHint` is not `true`.

Authorization, CLI show/display guards, and RBAC stay on the netx `/mcp` server.

## Forced mounts

`dsh-netxops/tools-ops` | `tools-topology` | `tools-biz-monitor` (legacy aliases: `tools-nms` / `tools-common` → ops).

## Offline

When `/mcp` is unreachable, the Plugins card shows the last cached tools/list and a disconnected hint. Registration uses that cache so toggles still work until connect recovers.
