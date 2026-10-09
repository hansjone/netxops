# Link DSH peer packages into this checkout for local `dsh plugin add <path>` / `link:`.
#
# Node resolves imports from the realpath of a linked package. A junction out of
# ~/.dsh/profiles/<name>/node_modules therefore cannot see the profile's
# hoisted peers or the healed profiles/node_modules fallback. Point the peers
# this package imports at the shared installation copy instead.
#
# Usage (PowerShell):
#   .\scripts\link-dsh-peers.ps1
# Optional:
#   .\scripts\link-dsh-peers.ps1 -DshHome $env:DSH_HOME

param(
  [string]$DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }),
  [string]$Profile = 'desktop'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$DstRoot = Join-Path $Root 'node_modules\@deepseek-ai'
# Shared heal first — profile-local schemastery (Desktop 0.2 = 3.18.4) breaks
# Config({}) when mixed with shared dsh-* 0.1.5-rc.2 (volatile proxies, Host fail).
$SearchRoots = @(
  (Join-Path $DshHome 'profiles\node_modules\@deepseek-ai'),
  (Join-Path $DshHome "profiles\$Profile\node_modules\@deepseek-ai"),
  (Join-Path $DshHome 'profiles\web\node_modules\@deepseek-ai')
)

# Runtime imports from src/index.ts (and peers they commonly need nearby).
$Peers = @(
  'schemastery',
  'cordis',
  'dsh-credentials',
  'dsh-settings',
  'dsh-tools',
  'dsh-llm'
)

New-Item -ItemType Directory -Force -Path $DstRoot | Out-Null
Write-Host "DSH_HOME=$DshHome profile=$Profile"

foreach ($name in $Peers) {
  $src = $null
  foreach ($root in $SearchRoots) {
    $candidate = Join-Path $root $name
    if (Test-Path (Join-Path $candidate 'package.json')) {
      $src = $candidate
      break
    }
  }
  if (-not $src) {
    throw "Peer @deepseek-ai/$name not found under:`n  $($SearchRoots -join "`n  ")"
  }
  $dst = Join-Path $DstRoot $name
  if (Test-Path $dst) {
    $item = Get-Item $dst -Force
    if ($item.LinkType -eq 'Junction' -or $item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
      cmd /c "rmdir `"$dst`""
    } else {
      Remove-Item -Recurse -Force $dst
    }
  }
  New-Item -ItemType Junction -Path $dst -Target $src | Out-Null
  $ver = (Get-Content (Join-Path $src 'package.json') -Raw | ConvertFrom-Json).version
  Write-Host "linked @deepseek-ai/$name@$ver <- $src"
}

Write-Host "Done. Restart DeepSeek Harness Desktop (or disable/enable dsh-netxops)."
