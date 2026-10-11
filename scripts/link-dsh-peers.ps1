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
# Select one complete peer set, avoiding packages from different Host generations.
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
  'dsh-scope',
  'dsh-llm'
)

New-Item -ItemType Directory -Force -Path $DstRoot | Out-Null
Write-Host "DSH_HOME=$DshHome profile=$Profile"
$CoherentRoot = $null
foreach ($searchRoot in $SearchRoots) {
  $complete = $true
  foreach ($peer in $Peers) {
    if (-not (Test-Path -LiteralPath (Join-Path $searchRoot "$peer\package.json"))) { $complete = $false; break }
  }
  if ($complete) { $CoherentRoot = $searchRoot; break }
}
if (-not $CoherentRoot) { throw 'No complete Harness peer set found; refusing to mix package generations.' }

foreach ($name in $Peers) {
  $src = $null
  foreach ($root in @($CoherentRoot)) {
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
  $absoluteDst = [IO.Path]::GetFullPath($dst)
  $absolutePeerRoot = [IO.Path]::GetFullPath($DstRoot).TrimEnd('\')
  if ([IO.Path]::GetDirectoryName($absoluteDst) -ne $absolutePeerRoot) {
    throw "Refusing to replace a path outside the peer directory: $absoluteDst"
  }
  if (Test-Path $dst) {
    $item = Get-Item $dst -Force
    if ($item.LinkType -eq 'Junction' -or $item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
      Remove-Item -LiteralPath $absoluteDst -Force
    } else {
      throw "Refusing to replace a non-link peer directory: $absoluteDst"
    }
  }
  New-Item -ItemType Junction -Path $dst -Target $src | Out-Null
  $ver = (Get-Content (Join-Path $src 'package.json') -Raw | ConvertFrom-Json).version
  Write-Host "linked @deepseek-ai/$name@$ver <- $src"
}

Write-Host "Done. Restart DeepSeek Harness Desktop (or disable/enable dsh-netxops)."
