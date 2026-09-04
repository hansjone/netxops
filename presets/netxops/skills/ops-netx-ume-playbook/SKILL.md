---
name: ops-netx-ume-playbook
description: >-
  Netx Ops UME playbook: alarm query/aggregate/diagnostics, NE inventory,
  raw fields, read-only SQL, and alarm-related topology path lookup.
  Trigger: UME alarms, host_name, Critical Top, LOS, BN EMS, netx ops.
---

# Ops Netx UME playbook

## Scope

For any Netx Ops request about UME **alarms** or **NE inventory**, load this skill first.

## Tool names

Host tool names are `mcp__netx__<camelCase>` (`serverName=netx`):

| Purpose | Tool |
|---------|------|
| Alarm list | `queryUmeAlarms` |
| Alarm aggregate | `aggregateUmeAlarms` |
| Diagnostics | `runUmeDiagnostics` |
| NE inventory | `queryUmeNeInventory` |
| NE detail | `getUmeNe` |
| Field list | `listUmeAlarmFields` |
| Raw rows | `queryUmeAlarmsRaw` |
| Dynamic aggregate | `aggregateUmeAlarmsRaw` |
| SQL | `sqlQueryUme` |
| Topology paths | `findTopologyPaths` |
| Managed CLI (other skill) | `listManagedNe` / `getManagedNe` / `execManagedNe` / `listCliTargets` |

Do not use removed inline `netx_*` names.

## Tool order

1. **Freshness first**: `runUmeDiagnostics` or `aggregateUmeAlarms` → `meta.last_seen_min` / `last_seen_max`.
   - If max is far from now, treat as **snapshot**: time windows must fall inside that range — never blind `now()-30m`.
2. Overview: `aggregateUmeAlarms` + `runUmeDiagnostics`; samples via `queryUmeAlarms` (one page).
3. Evidence: `listUmeAlarmFields` → `queryUmeAlarmsRaw` (`field_preset=evidence` / `select_fields`).
4. Custom aggregate: `aggregateUmeAlarmsRaw` (`group_by=alarm_host_name`, …).
5. SQL: `sqlQueryUme` (SELECT only; set `statement_timeout_ms`).
6. Related path: take `ne_id` from alarms → `findTopologyPaths` (shortest first).
7. Device CLI: `ops-netx-managed-ne-playbook` — multi-NE must be **one** `execManagedNe` batch.

## Decision tree

- **Fleet / Top risk**: `runUmeDiagnostics` + `aggregateUmeAlarms` (missing host excluded by default; check `by_ne_missing`).
  - Critical Top-N: `aggregateUmeAlarms(severity=critical, top_ne=10)`.
  - Group by host: `aggregateUmeAlarms(group_by=alarm_host_name, …)` or `aggregateUmeAlarmsRaw`.
- **Time window**: `time_from` / `time_to` = `last_seen_at`; check freshness first.
- **Citeable rows**: `queryUmeAlarmsRaw` + `field_preset=evidence`.
- **Complex filters**: `sqlQueryUme`.
- **Critical port / fiber**: sample 1–2 `ne_id` → `findTopologyPaths` → then CLI if needed.
- **NE identity**: `queryUmeNeInventory(keyword=host_name)`; full raw via `getUmeNe`.

## Short-intent recipes (≤3 tool calls)

| User says | Recipe |
|-----------|--------|
| fiber cut / LOS / 断纤 / sitelist | `queryUmeAlarmsRaw(keyword=LOS)` and/or `keyword=Fiber Break`; reply **host_name** list + counts (not optical-power threshold) |
| offline / unmanaged / 离线 | keyword=`BN EMS` / NE communication failure; clarify unmanaged vs unreachable |
| Critical Top / tally | `aggregateUmeAlarms(severity=critical, top_ne=20)` |
| how many alarms / 现网告警数量 | `runUmeDiagnostics` or `aggregateUmeAlarms` → by_severity + freshness |
| CRC in area PAD / ACH / … | `queryUmeAlarmsRaw(keyword=CRC)` then keep `AREA-` hostname prefix |
| bandwidth / congestion (+ area) | keyword=`bandwidth`; filter hostname prefix; CLI confirm = top 3–5 NEs **one** batch |
| optical power **threshold** in area | keyword=`optical power`; keep `AREA-` hosts — **not** fiber-cut |
| dying gasp / BN EMS | See correlation below — do not stop at one NE |
| power / temperature / fan / undervoltage | matching keyword; scope host or area prefix |
| license | keyword=`License` |
| BGP / OSPF / ISIS / LDP / PW / Tunnel on host | host-scoped `queryUmeAlarmsRaw` |
| Port down / which segment | keyword=`Port down` or `LOS`; `object_name` + `findTopologyPaths` / LLDP |
| alarm on **one hostname** | `queryUmeAlarms` / Raw with that host only — never hijack unrelated playbooks |
| history / time range (`17.50-18.15`) | Resolve **WIB (UTC+7)** → `time_from`/`time_to`; check freshness first |

Confirm replies (`YES` / `confirm` / `继续`): continue the prior task; do not restart the query.

### Field vocabulary

- **Area** = hostname prefix before first `-` (`MDN-`, `ACH-`, …), case-insensitive starts-with.
- **Capacity A<>B / optical between sites** = interconnect SFP/optics CLI (managed-ne skill), not bandwidth-usage alarms alone.
- **Optical power threshold** ≠ fiber cut / LOS sitelist.
- **Local clock phrases**: Asia/Jakarta (WIB, UTC+7) unless user says otherwise.

### Dying gasp / BN EMS

1. Named NE: Raw keyword=`dying gasp` — note `object_name` / times.
2. Peer via `findTopologyPaths` and/or LLDP.
3. Peer: BN EMS / communication failure near that timestamp.
4. Reply both sides + times.

### Anti-patterns

1. Wrong playbook hijack (single-host ask → do not run license/daily scripts).
2. Narration-only final replies.
3. Dense Markdown pipe tables in chat-style channels — prefer `*bold*` + `-` lists.
4. Blind CLI retries with the same failed command.
5. Unfiltered dump of huge uncleared sets — always severity/keyword/host/area/time.

## Guardrails

- Prefer non-SQL; use SQL only when parameters cannot express the filter.
- Filter order: `severity` → `keyword`/`host_name` → time → `event_type`/`ne_id`.
- Lists ≤2 pages by default; `page_size` default 50; aggregate `top_ne` default 50; dynamic aggregate `limit≤200`.
- Top NEs: ignore `(host_name missing)` in rankings; report missing count separately.
- SQL: `statement_timeout_ms=8000`; no `WITH RECURSIVE`.
- `getManagedNe` needs **managed** `ne_id` only; UME UUID → `getUmeNe` / `execManagedNe(ume_ne_id=...)`.

## Display

- Primary NE key for users = **`host_name`** (`alarm_host_name` in raw).
- Never show bare `ne_id` UUID; use it only for filters / `findTopologyPaths`.

## Templates

See [reference.md](reference.md).
