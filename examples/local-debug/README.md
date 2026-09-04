# Local debug against DeepSeekHarness

## Link the preset

From this repo root:

```powershell
powershell -File .\scripts\link-preset.ps1
```

This junctions `presets\netxops` → `%USERPROFILE%\.dsh\.agent-presets\netxops` so DSH’s default `includeUserRoot` discovers it.

## Optional patch (extra preset root)

If you prefer not to touch `~/.dsh/.agent-presets`, start DSH with:

```powershell
cd D:\project\DeepSeekHarness
pnpm dsh web --patch D:\project\chatgpt\netxops\examples\local-debug\patch.cordis.yml
```

`patch.cordis.yml` replaces the `agent-presets` row to keep shipped + user roots and add this repo’s `presets/` directory. Adjust the path if your checkout differs.

## Env

```powershell
$env:NETX_API_URL = "http://127.0.0.1:8890"
# $env:NETX_API_TOKEN = "nxt_..."
```

Ensure `python -m netx_mcp` works in the same environment PATH that DSH will spawn.
