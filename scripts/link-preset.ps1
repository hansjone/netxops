# Link presets/netxops into the DSH user agent-presets root (Windows junction).
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Source = Join-Path $RepoRoot "presets\netxops"
$DshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE ".dsh" }
$TargetParent = Join-Path $DshHome ".agent-presets"
$Target = Join-Path $TargetParent "netxops"

if (-not (Test-Path $Source)) {
  throw "Missing preset dir: $Source"
}
New-Item -ItemType Directory -Force -Path $TargetParent | Out-Null
if (Test-Path $Target) {
  $item = Get-Item $Target -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
    cmd /c "rmdir `"$Target`""
  } else {
    throw "Target exists and is not a junction: $Target — remove or rename it first."
  }
}
cmd /c "mklink /J `"$Target`" `"$Source`""
Write-Host "Linked $Target -> $Source"
Write-Host "Restart dsh / open a new session and select preset 'netxops' (Netx Ops)."
