param(
  [string]$DshHome = $env:DSH_HOME,
  [ValidatePattern('^[\w-]+$')][string]$Profile = 'desktop'
)
$ErrorActionPreference = 'Stop'
$PreviousDshHome = $env:DSH_HOME
try {
  if ($DshHome) { $env:DSH_HOME = $DshHome }
  & node (Join-Path $PSScriptRoot 'link-dsh-peers.mjs') --profile $Profile
  if ($LASTEXITCODE -ne 0) { throw 'Peer linking failed.' }
} finally {
  $env:DSH_HOME = $PreviousDshHome
}
