# Local debug against DeepSeekHarness

## A. Link preset + install host bridge

```powershell
cd D:\project\chatgpt\netxops
powershell -File .\scripts\link-preset.ps1
powershell -File .\scripts\set-netx-token.ps1 -Token (Get-Content D:\project\chatgpt\netx\data\auth\mcp_token -Raw).Trim()
```

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

1. New session → preset **Netx Ops**
2. Tools include `mcp__netx__aggregateUmeAlarms`
3. Ask Critical Top / single host alarms
