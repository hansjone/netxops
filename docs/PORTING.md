# Porting notes (oclaw → netxops)

## In v1

| Source (oclaw) | Destination |
|----------------|-------------|
| `runtime/workspaces/ops/ROLE_SYSTEM.md` | `presets/netxops/PERSONA.md` + persona in `agent.cordis.yml` (brand **Netx Ops**) |
| `skills/_workspace/ops/ops-netx-ume-playbook/` | **Canonical:** `netx/skills/nms/netx-nms/` |
| `skills/_workspace/ops/ops-netx-managed-ne-playbook/` | **Canonical:** `netx/skills/common/netx-common/` |
| `skills/.../netx-topology` (MCP) | **Canonical:** `netx/skills/topology/netx-topology/` |
| netx MCP HTTP surface | Host plugin `src/netx/*` + `src/index.ts`: settings namespace `netxops` + credential `NETX_API_TOKEN` → native `netx__*` tools |

Adaptations: removed oclaw Admin / WhatsApp / `ume_alarm_xlsx_report` / wiki capture / skill_auto_install; fiber/offline recipes use Raw/aggregate tools only. DSH no longer spawns `python -m netx_mcp`. Model-facing NMS tools renamed to `*Nms*`; ZTE UME remains the `nmsProvider=zte-ume` adapter.

**Config UX:** Settings → Plugins → **Netx Ops** card (`src/client/` → `lib/client.js`). Token via credentials `NETX_API_TOKEN`; `apiUrl` / `lang` / capability groups / `nmsProvider` via settings namespace `netxops`.

## Stay in oclaw (until retired)

Gateway, WhatsApp/Weixin, Admin MCP UI, specialist router, memory-wiki, ops-ai HTTP, schedulers.

## Phase 2 candidates

- `ume_alarm_xlsx_report` + thin HTTP client as a DSH tool plugin
- NMS sync context inject
- `ops-ip-knowledge-playbook` + KB content
- Full dual_unit layout engine in-process (today: MCP or experimental stubs)
