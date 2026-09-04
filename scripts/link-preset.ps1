# Link / install presets/netxops into the DSH user agent-presets root.
# Prefer a real directory copy: DSH discovery skips Windows junctions
# (Dirent.isDirectory() is false for reparse points).
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Source = Join-Path $RepoRoot "presets\netxops"
$DshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE ".dsh" }
$TargetParent = Join-Path $DshHome ".agent-presets"
$Target = Join-Path $TargetParent "netxops"

if (-not (Test-Path (Join-Path $Source "agent.cordis.yml"))) {
  throw "Missing preset dir: $Source"
}
New-Item -ItemType Directory -Force -Path $TargetParent | Out-Null
if (Test-Path $Target) {
  Remove-Item -Recurse -Force $Target
}
Copy-Item -Recurse -Force $Source $Target
Set-Content -Path (Join-Path $Target ".dsh-netxops-managed") -Value ((Get-Date).ToString("o"))
Write-Host "Installed $Target (copy from $Source)"
Write-Host "Open Settings → Agent presets → Custom → Netx Ops (or new session)."
