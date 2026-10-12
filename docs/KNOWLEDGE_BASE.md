# Knowledge base

Operator-subset knowledge packages are wired through **netxops settings**, not into the netx API or `netx-ops` skill text.

**Role split**

| Surface | Responsibility |
|---------|----------------|
| `netx-ops` | Live netx evidence (alarms / inventory / CLI) — **pure netx**, no KB playbooks |
| `kb-context` | MANIFEST annotation (`KB_*`) + dual-plane write rules |
| `_skills/kb-*` | Shared operator KB triage / ingest / retrieve / export / package |
| `paths.localSkills` | Operator-local skills (alongside `_skills/`; same toggles) |

## Setup

1. Settings → Plugins → **Netx Ops** → **知识库 / Knowledge base**
2. Browse (or paste) a folder that contains (or uniquely nests ≤3 levels) a `MANIFEST.json` — browse auto-saves
3. Leave **知识库技能 → 在 Netx Ops 预设中启用** on (default) so `_skills/kb-*` register into Netx Ops sessions
4. Optionally enable **对其他预设公开** to publish those pack skills on the host public skill layer

## MANIFEST v1.0 (plugin checks)

| Field | Rule |
|-------|------|
| `schemaVersion` | must be `"1.0"` |
| `packageType` | must be `"operator-subset"` |
| `operator.name` / `operator.country` | required non-empty strings |
| `version` | required non-empty string |
| `content.*` | booleans; contract keys `hasRegions` / `hasTheory` / `hasPacket` / `hasCommon` / `hasSkills` (missing → `false`). Legacy short keys `regions`/`theory`/`packet`/`skills` map to `has*` when the contract key is absent |
| `paths.*` | optional relative dirs under package root (packaging-generated). Plugin uses `skills` (default `_skills`) and `localSkills`; missing / blank values skipped |

Location: `${kbRoot}/MANIFEST.json`, else recurse ≤3 levels and **exactly one** hit. Zero or multiple → error.

Authoritative packaging prose lives in the workspace contract notes (`插件` / `契约`); this doc only describes what the plugin enforces.

## Injected context

| Channel | Fields |
|---------|--------|
| `process.env` | `KB_ROOT`, `KB_LOCAL` (when `paths.local` set), `KB_OPERATOR`, `KB_COUNTRY`, `KB_VERSION`, `KB_CONTENT` (JSON of `has*`), `KB_PATHS` (JSON `{key: absolutePath}` of every `paths.*`), `KB_STATUS` |
| Skill `kb-context` | Same MANIFEST fields + `kbLocal` + **resolved absolute anchor table for every `paths.*`** + `{paths.local}/identity/*.md` inlined (README excluded; ≤8 KB/file, ≤24 KB total) + dual-plane write rules |
| Skills from pack | Registered when `configured` **and** `hasSkills` **and** the inPreset/public toggle for that plane. Each pack skill gets the same resolved anchor table appended, so playbooks never need to re-read MANIFEST or compose `regions/<c>/<o>/…` |
| KB read tools | When `configured` + KB toggles: `netx__kbSearch` / `netx__kbRead`, jailed (realpath-checked) to `kbRoot` |
| Local FS tools | When `configured` + `paths.local` + same KB toggles: `netx__kbWriteRef` / `WriteMemory` / `WriteDraft` / `WriteSuggestion` / `UpdateLocal` / `DeleteLocal` / `ListLocal` — jail under `refs\|memories\|drafts\|suggestions`. HQ pack is read-only; evolve site product knowledge with `kbWriteRef` (per-`host_name` PROFILE) and capture experience with `kbWriteMemory` as it appears. |

RPC (channel `/netxops`): `kb.status` (published snapshot), `kb.reload` (re-resolve live `kbRoot` + **force** republish — remounts skills/tools even when MANIFEST is unchanged, so edited `SKILL.md`, new `local_skills/` or `identity/` files are picked up), `kb.resolve` with `{ path }` (preview unsaved paths).

MANIFEST may carry a UTF-8 BOM (PowerShell 5.1 `Out-File`/`Set-Content -Encoding UTF8`); it is stripped before parsing. A `local_skills/` bundle whose `name` duplicates a pack skill is skipped with a warning (pack wins) instead of aborting the whole pack registration.

## Pack skill registration

When `KB_STATUS=configured` and `content.hasSkills=true`, the plugin scans (same register rules / toggles / `provider: netxops-kb-pack`):

```text
${realRoot}/${paths.skills || '_skills'}/*/SKILL.md
${realRoot}/${paths.localSkills}/*/SKILL.md   # only when paths.localSkills is set
```

`paths.localSkills` missing, blank, or an empty/missing directory → skipped (ops continues). Invalid `SKILL.md` bundles are skipped the same way as under `_skills/`.

| Setting | Default | Plane |
|---------|---------|-------|
| `groupKbInPreset` | `true` | Netx Ops preset sessions |
| `groupKbPublic` | `false` | Host public skills (other presets) |

Invalid or missing `_skills` directories are skipped (ops continues).

## Degradation matrix

| Condition | `KB_STATUS` | Behavior |
|-----------|-------------|----------|
| Empty `kbRoot` | `unconfigured` | Pure netx; no invented operator; no kb-* packs |
| Missing / ambiguous / invalid MANIFEST | `error` | Pure netx; badge shows error detail |
| Valid MANIFEST, `hasSkills=false` | `configured` | Identity only (`kb-context` + env) |
| Valid + `hasSkills` + toggles | `configured` | Identity + pack skills (`_skills` / `paths.skills`) and optional `paths.localSkills` on the enabled plane(s) |

**Never** invent an operator when status is not `configured`.
