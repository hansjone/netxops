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
| `process.env` | `KB_ROOT`, `KB_LOCAL` (when `paths.local` set), `KB_OPERATOR`, `KB_COUNTRY`, `KB_VERSION`, `KB_CONTENT` (JSON of `has*`), `KB_STATUS` |
| Skill `kb-context` | Same MANIFEST fields + `kbLocal` + dual-plane write rules (refs / memories / drafts / suggestions) |
| Skills from pack | Registered when `configured` **and** `hasSkills` **and** the inPreset/public toggle for that plane |
| Local FS tools | When `configured` + `paths.local` + same KB toggles: `netx__kbWriteRef` / `WriteMemory` / `WriteDraft` / `WriteSuggestion` / `UpdateLocal` / `DeleteLocal` / `ListLocal` — jail under `refs\|memories\|drafts\|suggestions`. HQ pack is read-only; evolve site product knowledge with `kbWriteRef` (per-`host_name` PROFILE) and capture experience with `kbWriteMemory` as it appears. |

RPC (channel `/netxops`): `kb.status` (published snapshot), `kb.reload` (re-resolve live `kbRoot` + republish), `kb.resolve` with `{ path }` (preview unsaved paths).

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
