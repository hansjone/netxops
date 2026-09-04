# Ops Netx UME quick reference

## 0) Freshness (required)

- `runUmeDiagnostics` / `aggregateUmeAlarms` → `meta.last_seen_min` / `last_seen_max`
- Snapshot data: windows inside min~max — **do not** default to `now()-30 minutes`

## 1) Current alarms (light)

- Tool: `queryUmeAlarms`
- Params: `severity`, `host_name`, `ne_id` (filter only), `keyword`, `time_from`, `time_to`, `page`, `page_size`
- Suggest: `page_size=50`; at most 2 pages by default

## 2) Raw evidence

- Tool: `queryUmeAlarmsRaw`
- Optional: `listUmeAlarmFields`
- `field_preset`: `brief` / `evidence` / `ne_debug`
- Display key: `alarm_host_name`

## 3) Aggregate

- `aggregateUmeAlarms`: `severity`, `top_ne`, `exclude_missing_host`, time window
  - Critical Top: `severity=critical`
  - `group_by=alarm_host_name` → dynamic aggregate path
- `aggregateUmeAlarmsRaw`: custom `group_by`

## 3b) Short paths

| Intent | Call |
|--------|------|
| Critical Top | `aggregateUmeAlarms(severity=critical, top_ne=20)` |
| Fiber / LOS sitelist | Raw `keyword=LOS` and/or `Fiber Break` → host list |
| Offline / BN EMS | Raw keyword=`BN EMS` |
| Area optical threshold | Raw `keyword=optical power` + `AREA-` prefix — **not** fiber cut |
| Single host alarms | `queryUmeAlarms(host_name=…)` |
| dying gasp | local dying gasp → peer BN EMS near time |
| Capacity A<>B | resolve hosts → `findTopologyPaths` / LLDP → optic CLI (managed-ne) |
| History (WIB) | freshness → `time_from`/`time_to` |

## 4) Diagnostics

- `runUmeDiagnostics`
- `top_event_types`, `top_alarm_codes`, `top_ne`, `meta.last_seen_*`

## 4b) Inventory

- `queryUmeNeInventory(keyword=…)`
- `getUmeNe` for full `raw_json`

## 5) Paths

- `findTopologyPaths(from_ume_ne_id, to_ume_ne_id)` — default `detail=summary`

## 6) SQL

- `sqlQueryUme` SELECT only; `statement_timeout_ms=8000`
- Prefer aggregate/raw when SQL scope is insufficient
