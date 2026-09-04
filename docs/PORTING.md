# Porting notes (oclaw → netxops)

## In v1

| Source (oclaw) | Destination |
|----------------|-------------|
| `runtime/workspaces/ops/ROLE_SYSTEM.md` | `presets/netxops/PERSONA.md` + persona text in `agent.cordis.yml` (brand **Netx Ops**) |
| `skills/_workspace/ops/ops-netx-ume-playbook/` | `presets/netxops/skills/ops-netx-ume-playbook/` |
| `skills/_workspace/ops/ops-netx-managed-ne-playbook/` | `presets/netxops/skills/ops-netx-managed-ne-playbook/` |
| netx MCP contract | `agent.cordis.yml` → `dsh-mcp-client` |

Adaptations: removed oclaw Admin / WhatsApp / `ume_alarm_xlsx_report` / wiki capture / skill_auto_install lanes; fiber/offline recipes use Raw/aggregate MCP only.

## Stay in oclaw

Gateway, WhatsApp/Weixin, Admin MCP UI, specialist router, memory-wiki, ops-ai HTTP, schedulers.

## Phase 2 candidates

- `ume_alarm_xlsx_report` + thin HTTP client as a DSH tool plugin
- UME sync context inject
- `ops-ip-knowledge-playbook` + KB content
- `netx-topology` MCP + topology skill
