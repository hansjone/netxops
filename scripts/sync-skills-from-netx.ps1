# Sync canonical netx/skills → dsh-netxops presets (npm embed only).
# MCP packages do NOT carry a skills/ mirror — point Cursor/hosts at netx/skills/.
param(
  [string]$NetxRoot = ""
)
$ErrorActionPreference = "Stop"
$opsRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $NetxRoot) {
  $sibling = Join-Path $opsRoot "..\netx"
  if (Test-Path (Join-Path $sibling "skills")) {
    $NetxRoot = (Resolve-Path $sibling).Path
  } else {
    throw "Pass -NetxRoot or place netx checkout next to netxops (../netx/skills)"
  }
}
$src = Join-Path $NetxRoot "skills"
$dst = Join-Path $opsRoot "presets\netxops\skills"
if (-not (Test-Path $src)) { throw "missing $src" }

foreach ($group in @("nms", "common", "topology")) {
  $from = Join-Path $src $group
  $to = Join-Path $dst $group
  if (-not (Test-Path $from)) { throw "missing group $from" }
  if (Test-Path $to) { Remove-Item $to -Recurse -Force }
  New-Item -ItemType Directory -Force -Path (Split-Path $to) | Out-Null
  Copy-Item $from $to -Recurse -Force
}

# Drop legacy separate layout skill if present
$legacyLayout = Join-Path $dst "topology-layout"
if (Test-Path $legacyLayout) { Remove-Item $legacyLayout -Recurse -Force }

@"
# Mirrored from netx/skills — do not long-edit here

Canonical: ``$NetxRoot\skills``

```powershell
powershell -File .\scripts\sync-skills-from-netx.ps1
```

Runtime prefers ``NETX_SKILLS_ROOT`` or sibling ``../netx/skills``.
One topology skill covers canvas + dual_unit / layout recipes; DSH may still gate **tools** via topology vs topology-layout groups.
"@ | Set-Content -Encoding utf8 (Join-Path $dst "README.md")

Write-Host "Synced $src -> $dst"
Get-ChildItem -Recurse $dst -Filter SKILL.md | ForEach-Object { $_.FullName.Substring($opsRoot.Path.Length) }
