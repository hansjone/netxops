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
  [string]$DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' })
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$SrcRoot = Join-Path $DshHome 'profiles\node_modules\@deepseek-ai'
$DstRoot = Join-Path $Root 'node_modules\@deepseek-ai'

# Runtime imports from src/index.ts (and peers they commonly need nearby).
$Peers = @(
  'schemastery',
  'cordis',
  'dsh-credentials',
  'dsh-settings',
  'dsh-mcp-client',
  'dsh-tools'
)

if (-not (Test-Path $SrcRoot)) {
  throw "DSH installation fallback missing: $SrcRoot`nRun ``dsh web`` once (or any profile) so dsh heals profiles/node_modules."
}

New-Item -ItemType Directory -Force -Path $DstRoot | Out-Null

foreach ($name in $Peers) {
  $src = Join-Path $SrcRoot $name
  $dst = Join-Path $DstRoot $name
  if (-not (Test-Path $src)) {
    throw "Peer not found under installation fallback: $src"
  }
  if (Test-Path $dst) {
    $item = Get-Item $dst -Force
    if ($item.LinkType -eq 'Junction' -or $item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
      cmd /c "rmdir `"$dst`""
    } else {
      Remove-Item -Recurse -Force $dst
    }
  }
  New-Item -ItemType Junction -Path $dst -Target $src | Out-Null
  Write-Host "linked @deepseek-ai/$name -> $src"
}

Write-Host "Done. Re-run: dsh web"
