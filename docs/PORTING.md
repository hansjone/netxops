# Porting notes (oclaw → netxops)

## In v1

| Source (oclaw) | Destination |
|----------------|-------------|
| `runtime/workspaces/ops/ROLE_SYSTEM.md` | `presets/netxops/PERSONA.md` + persona in `agent.cordis.yml` (brand **Netx Ops**) |
| `skills/_workspace/ops/ops-netx-ume-playbook/` | `presets/netxops/skills/ops-netx-ume-playbook/` |
| `skills/_workspace/ops/ops-netx-managed-ne-playbook/` | `presets/netxops/skills/ops-netx-managed-ne-playbook/` |
| netx MCP HTTP surface | Host plugin `src/netx/*` + `src/index.ts`: settings namespace `netxops` + credential `NETX_API_TOKEN` → native `netx__*` tools |

Adaptations: removed oclaw Admin / WhatsApp / `ume_alarm_xlsx_report` / wiki capture / skill_auto_install; fiber/offline recipes use Raw/aggregate tools only. DSH no longer spawns `python -m netx_mcp`.

**Config UX:** Settings → Plugins → **Netx Ops** card (`src/client/` → `lib/client.js`). Token via credentials `NETX_API_TOKEN`; `apiUrl` / `lang` via settings namespace `netxops`.

## Stay in oclaw

Gateway, WhatsApp/Weixin, Admin MCP UI, specialist router, memory-wiki, ops-ai HTTP, schedulers.

## Phase 2 candidates

- `ume_alarm_xlsx_report` + thin HTTP client as a DSH tool plugin
- UME sync context inject
- `ops-ip-knowledge-playbook` + KB content
- `netx-topology` MCP + topology skill
