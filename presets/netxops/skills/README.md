# Mirrored from netx/skills — do not long-edit here

Canonical: `D:\project\chatgpt\netx\skills`

```powershell
powershell -File .\scripts\sync-skills-from-netx.ps1
```

Runtime prefers `NETX_SKILLS_ROOT` or sibling `../netx/skills`.
Groups: **ops** (`netx-ops`) + **topology** (`netx-topology`). One group ↔ one skill.

**Keep netx-ops pure netx** (alarms / inventory / CLI). Knowledge-base triage belongs in
operator-subset `_skills/kb-*` packs registered by the plugin — do **not** write KB linkage
back into `netx-ops`.
