# Set NETX_API_TOKEN in the DSH credentials store (no OS env required).

param(
  [Parameter(Mandatory = $true)]
  [string] $Token,
  [string] $DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE ".dsh" })
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($Token)) { throw "Token is empty" }

New-Item -ItemType Directory -Force -Path $DshHome | Out-Null
$path = Join-Path $DshHome ".credentials.yaml"

# Minimal merge: preserve other refs if file exists and is simple version:1 docs.
$escaped = $Token.Replace("'", "''")
if (-not (Test-Path $path)) {
  @"
version: 1

refs:
  NETX_API_TOKEN: '$escaped'
"@ | Set-Content -Path $path -Encoding utf8
  Write-Host "Created $path with NETX_API_TOKEN"
  exit 0
}

$raw = Get-Content -Path $path -Raw
if ($raw -match '(?m)^\s*NETX_API_TOKEN\s*:') {
  $raw = [regex]::Replace($raw, '(?m)^(\s*NETX_API_TOKEN\s*:\s*).*$', "`${1}'$escaped'")
} elseif ($raw -match '(?m)^refs\s*:') {
  $raw = [regex]::Replace($raw, '(?m)^(refs\s*:\s*\r?\n)', "`${1}  NETX_API_TOKEN: '$escaped'`n")
} else {
  $raw = $raw.TrimEnd() + "`n`nrefs:`n  NETX_API_TOKEN: '$escaped'`n"
}
Set-Content -Path $path -Value $raw -Encoding utf8
Write-Host "Updated NETX_API_TOKEN in $path"
Write-Host "If dsh is running, wait for credential reload or restart dsh web."
