---
name: ops-netx-managed-ne-playbook
description: >-
  Netx Ops managed-NE playbook: device list, connect status, read-only CLI
  via SSH/Telnet (batch-first). Trigger: execManagedNe, show/display, optical, capacity A<>B.
---

# Ops Netx managed NE playbook

## Scope

Load this skill whenever you must **log into** devices registered under netx **managed NE** (or UME CLI profiles) to run show/display/ping.

Differs from UME inventory (`ops-netx-ume-playbook`): this is **SSH/Telnet** (ZTE/Huawei/Cisco hops, Linux tunnels, bastion), not UME REST sync alone.

## Tool order

Use `netx__*`.

1. **Locate**
   - `listManagedNe`: `keyword`, `connect_status=pass` (preferred)
   - `getManagedNe`: only for `connect_detail`; **managed `ne_id` only**
   - Do **not** pass UME alarm UUIDs as managed `ne_id`; on failure follow returned `hint`
   - UME without per-device managed rows: `listCliTargets(source=ume)` or inventory → `execManagedNe(ume_ne_id=…)` (requires netx **UME → CLI** profile)
2. **Execute**
   - `execManagedNe`: `ne_id` **or** `ume_ne_id` + `commands` (default max 5; `NETX_NE_EXEC_MAX_COMMANDS`, hard cap 50)
   - **Multi-NE = batch-first (one tool call; server concurrency default 4, max 20)**:
     - Same commands: `ne_ids` / `ume_ne_ids` + shared `commands`
     - Different commands per NE: `targets=[{ume_ne_id|ne_id, commands:[…]}, …]`
   - Many single-NE calls in one turn are **serial** — forbidden for multi-NE work
   - Per session: call `listCliTargets` at most once; merge shows into each target's `commands[]`
   - Timeouts: raise `read_timeout_sec` (default 60; slow 90–120) or fewer commands — no blind retry

## Field link recipes

### Capacity / optical between two names

User says **capacity**, **bandwidth between A and B**, **optical power A <> B**, or site pairs:

1. Resolve nicknames → real `host_name` via inventory.
2. Interconnect: `findTopologyPaths` and/or LLDP — both ports.
3. Optics on **both** ends with correct vendor command. Summarize interface, RX/TX, thresholds, link up.
4. Do not answer with only UME bandwidth-usage or optical-threshold **alarm** tallies unless asked.
5. Prefer one batch (`targets` if vendors differ).

### Area optical-power **alarm** list (UME only)

Use UME keyword=`optical power` + hostname prefix — **not** this CLI recipe.

### ZTE optical CLI

Try in order; one failure → switch command (do not retry same spelling):

| Prefer | Notes |
|--------|-------|
| `show opticalinfo brief` | Field-confirmed on many ZXR10 |
| `show optical brief` | Some EN platforms |
| `show opticalinfo brief \| begin <if>` | After port known |

Cisco/Huawei: allowlisted `show interface transceiver` / `display optical-module` style.

### Multi-NE examples

**Same command, many NEs (one call):**

```json
{
  "ume_ne_ids": ["uuid-a", "uuid-b", "uuid-c"],
  "commands": ["show version"],
  "read_timeout_sec": 60,
  "concurrency": 4
}
```

**Different commands (still one call):**

```json
{
  "targets": [
    {"ume_ne_id": "uuid-zte", "commands": ["show opticalinfo brief"]},
    {"ume_ne_id": "uuid-hw", "commands": ["display optical-module brief"]},
    {"ume_ne_id": "uuid-cisco", "commands": ["show interface transceiver"]}
  ],
  "read_timeout_sec": 90
}
```

**Wrong:** N× single-NE `execManagedNe` in one turn (serial + budget burn).

## CLI constraints (server-enforced)

- Allowed prefixes: `show `, `display `, `ping `, `ping6 `, `traceroute `, `tracert `, `trace `, `trace6 `
- Pipes: whitelist filters only (`include`/`exclude`/`begin`/…); no `redirect`/`tee`
- Forbidden: `;`, newlines, config/write/reload/delete
- Examples: `show version`, `display current-configuration | include sysname`, `ping 192.168.0.1`

## Troubleshooting

1. `connect_status=fail`: read `getManagedNe` `connect_detail` — do not blind-exec.
2. Hop / bastion: verify `hop_enabled`, `hop_vendor`, templates.
3. Timeout: raise `read_timeout_sec` (max 120) or fewer commands.

## Output

- Conclusion + **tool output excerpts** (never invent CLI).
- Prefer name/IP for users; keep `ne_id` as correlation key only.
- English sessions: no Chinese in user-visible prose (device output may be quoted as device text).
