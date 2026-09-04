# Porting notes (oclaw → netxops)

## In v1

| Source (oclaw) | Destination |
|----------------|-------------|
| `runtime/workspaces/ops/ROLE_SYSTEM.md` | `presets/netxops/PERSONA.md` + persona in `agent.cordis.yml` (brand **Netx Ops**) |
| `skills/_workspace/ops/ops-netx-ume-playbook/` | `presets/netxops/skills/ops-netx-ume-playbook/` |
| `skills/_workspace/ops/ops-netx-managed-ne-playbook/` | `presets/netxops/skills/ops-netx-managed-ne-playbook/` |
| netx MCP + API URL/token | Host plugin `src/index.ts` (`dsh-netxops`): settings namespace `netxops` + credential `NETX_API_TOKEN` → dynamic `dsh-mcp-client` |

Adaptations: removed oclaw Admin / WhatsApp / `ume_alarm_xlsx_report` / wiki capture / skill_auto_install; fiber/offline recipes use Raw/aggregate MCP only.

**Config UX:** not OS env. Token via DSH credentials (same as model keys); `apiUrl` via settings / composition config. Plugins settings **card** (browser half) TBD per DSH cookbook.

## Stay in oclaw

Gateway, WhatsApp/Weixin, Admin MCP UI, specialist router, memory-wiki, ops-ai HTTP, schedulers.

## Phase 2 candidates

- Plugins settings card (`dsh.client`) for apiUrl + token on Settings → Plugins
- `ume_alarm_xlsx_report` + thin HTTP client as a DSH tool plugin
- UME sync context inject
- `ops-ip-knowledge-playbook` + KB content
- `netx-topology` MCP + topology skill
