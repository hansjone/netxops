param([ValidatePattern('^[\w-]+$')][string]$Profile = 'desktop')
$ErrorActionPreference = 'Stop'
& node (Join-Path $PSScriptRoot 'install-preset.mjs') --profile $Profile
if ($LASTEXITCODE -ne 0) { throw 'Preset installation failed.' }
