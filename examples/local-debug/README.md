# Local debug against DeepSeekHarness

## A. Link preset + install host bridge

```powershell
cd D:\project\chatgpt\netxops
powershell -File .\scripts\link-dsh-peers.ps1
powershell -File .\scripts\link-preset.ps1
powershell -File .\scripts\set-netx-token.ps1 -Token (Get-Content D:\project\chatgpt\netx\data\auth\mcp_token -Raw).Trim()
```

`link-dsh-peers.ps1` is required for path/`link:` installs: Node resolves peers from the checkout realpath, not from the profile `node_modules`. Run it after the first successful `dsh` boot (so `~/.dsh/profiles/node_modules` exists).

From DeepSeekHarness (source):

```powershell
cd D:\project\DeepSeekHarness
pnpm dsh plugin --profile web add D:\project\chatgpt\netxops
# or one-shot overlay:
pnpm dsh web --patch D:\project\chatgpt\netxops\examples\local-debug\patch.cordis.yml
```

## B. What the debug patch does

[`patch.cordis.yml`](patch.cordis.yml):

1. Ensures agent-presets can see `D:/project/chatgpt/netxops/presets`
2. Inserts host plugin `dsh-netxops` via **absolute path** to `src/index.ts` (no npm link required)

Adjust paths if your checkout differs.

## C. Verify

1. Settings → Plugins → **Netx Ops** card shows URL / token fields (after `bun run bundle` if you edited `src/client/`)
2. New session → preset **Netx Ops**
3. Tools include `mcp__netx__aggregateUmeAlarms`
4. Ask Critical Top / single host alarms
