# Knowledge base (P1)

Operator-subset knowledge packages are wired through **netxops settings**, not into the netx API or `netx-ops` skill text.

## Setup

1. Settings → Plugins → **Netx Ops** → **知识库 / Knowledge base**
2. Set **知识包根目录** to a folder that contains (or uniquely nests ≤3 levels) a `MANIFEST.json`
3. Save — Host injects env + a `kb-context` skill for new sessions

Browse uses Host `remote.directoryPicker` when available; otherwise paste an absolute path.

## MANIFEST v1.0 (plugin checks)

| Field | Rule |
|-------|------|
| `schemaVersion` | must be `"1.0"` |
| `packageType` | must be `"operator-subset"` |
| `operator.name` / `operator.country` | required non-empty strings |
| `version` | required non-empty string |
| `content.*` | object of booleans; missing keys → `false` (`regions` / `theory` / `packet` / `skills` known) |

Location: `${kbRoot}/MANIFEST.json`, else recurse ≤3 levels and **exactly one** hit. Zero or multiple → error.

Authoritative packaging prose lives in the workspace contract notes (`插件` / `契约`); this doc only describes what the plugin enforces.

## Injected context

| Channel | Fields |
|---------|--------|
| `process.env` | `KB_ROOT`, `KB_OPERATOR`, `KB_COUNTRY`, `KB_VERSION`, `KB_CONTENT` (JSON), `KB_STATUS` |
| Skill `kb-context` | Same identity for the model (markdown table) |

RPC (channel `/netxops`): `kb.status` (saved snapshot), `kb.resolve` with `{ path }` (preview unsaved paths).

## Degradation matrix

| Condition | `KB_STATUS` | Behavior |
|-----------|-------------|----------|
| Empty `kbRoot` | `unconfigured` | Pure netx; skill says do not invent an operator |
| Missing / ambiguous / invalid MANIFEST | `error` | Pure netx; badge shows error detail |
| Valid MANIFEST | `configured` | Paths + operator identity available |

**Never** invent an operator when status is not `configured`. P2 knowledge-base skill packs (case search, etc.) are out of scope for this release.
