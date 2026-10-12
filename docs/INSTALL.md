# 安装 Netx Ops

## 桌面版

打开 Harness 的插件管理页面，选择“添加插件”，填入：

```text
github:hansjone/netxops
```

也可填入发布包 `dsh-netxops-<版本>.tgz` 的绝对路径。面向普通用户推荐使用明确版本的发布包：安装时无需 GitHub 访问、Bun、Python、源码目录或编译步骤。不要将开发者电脑上的目录路径作为公共安装地址。

安装完成后重启桌面版一次，使预设配置加载。

## Web 版

```sh
dsh plugin --profile web add github:hansjone/netxops
dsh web
```

使用已经下载的发布包，例如：

```powershell
dsh plugin --profile web add "D:\Downloads\dsh-netxops-0.1.71.tgz"
dsh web
```

按实际位置替换包路径；已有 Web Host 需重启一次。两种安装方式均使用包内预编译 JS，不会在用户电脑上运行安装编译脚本。Desktop 与 Web 是不同的 Host profile，需要分别安装和配置。

## 首次配置

1. 设置 → 插件 → **Netx Ops**，填写 Netx API 地址和 API token。
2. 为运维、拓扑、业务监控和知识库选择发布范围：Netx Ops、指定预设或全部预设。
3. 新建会话，选择 **Netx Ops**，或选择已经获得 Netx 能力的其他预设。

默认仅向 Netx Ops 发布运维与业务监控能力；拓扑与全预设公开默认关闭。未配置知识库时不会发布知识库能力。关闭总开关会撤销插件管理的工具和技能，同时保留各组选择。

能力开关与预设选择自动保存，下一次模型请求使用新策略。API 地址、token、模型语言、告警配置和手工输入的知识库路径使用保存/丢弃；有草稿修改时操作栏才显示。通过目录选择器选择知识库路径会自动保存。

Netx API 服务与对应权限的 token 是调用工具的前提；安装插件本身不需要连接 Netx 服务。默认地址为 `http://127.0.0.1:8890`，远程 Host 应配置从该 Host 可访问的地址。Harness 内部依赖与 React 由 Harness 提供，不需要从 npm 单独安装。

## 可选功能

**告警推送到 Harness 会话**直接使用 Netx URL/token，无需 IM 插件。只有选择 IM 投递时才需要单独安装并配置 `dsh-im-ops`；定时能力按需安装 `dsh-ops-cron`：

```sh
dsh plugin --profile web add github:hansjone/dsh-im-ops
dsh plugin --profile web add github:hansjone/dsh-ops-cron
```

两个 companion 插件不是 Netx Ops 的默认安装项或运行依赖。需要时作为 profile 的直接依赖安装，不要写入 Netx Ops 的嵌套 `github:` 依赖。

**知识库**：选择包含 MANIFEST 的知识库根目录，并设置发布范围。详见 [知识库说明](KNOWLEDGE_BASE.md)。

**会话导出**：设置页可下载此 Host 的持久化会话 ZIP，需要 JSONL 持久化后端。导出不是安装条件。

## 安装与启动排查

- **下载 GitHub 包失败**：检查网络与 GitHub 可达性，或改用已经下载的版本 `.tgz`。更换 npm 镜像无法修复 GitHub 本身的连接失败。
- **提示缺少 `@deepseek-ai/*`**：先确认 Harness 本身可以启动。公共发布包无需额外安装内部包；只有开发用 `link:` 路径安装才需要下面的 peer 链接步骤。
- **插件激活失败**：从插件管理页展开具体 Host 加载错误。升级后分别完整重启 Desktop/Web，确认两者装入的是同一目标版本。0.1.70 包含 volatile 配置兼容与全新 profile 的 YAML 修复。
- **Netx Ops 预设未出现**：检查 Host 是否启用、日志是否有 standard 模板读取或预设写入错误，然后重启对应 Host。预设从当前 Host 的 standard 组合生成。用户自建同名预设与修改过的文件会保留；请按日志处理冲突。
- **设置页仍在等待连接**：确认 Host 插件已激活，刷新页面或重启升级后的 Host；持续失败时同时提供 Host 加载日志与插件版本。
- **工具不可用**：确认总开关、对应能力组和当前预设的发布范围，再检查 API 地址、服务连通性和 token 权限。

安装器只更新当前 profile，保留其他 profile、用户配置、用户预设和无法确认未修改的文件。若发现不支持的 profile 文档结构，会保留原文件并记录错误，避免写入损坏的配置。

## 本地源码开发

普通用户无需执行本节。源码 `link:` 安装时，Node 会从工作区真实路径解析依赖，因此需要将当前 Harness 的一套完整 peers 链接到工作区：

```powershell
pnpm install --frozen-lockfile --ignore-scripts
bun run bundle
dsh plugin --profile desktop add D:\path\to\netxops
node scripts/link-dsh-peers.mjs --profile desktop
```

Web 开发将 profile 改为 `web`。脚本优先选择该 profile 的完整依赖集，再选择共享 Host 依赖；不会混用不同 profile 的内部包。Shell 与 PowerShell 包装脚本使用同一实现。

手工预设安装仅用于排查，可在源码仓库运行 `node scripts/install-preset.mjs --profile web`。它使用正式安装器的组合、保留与 profile 更新规则，不会先删除已有预设。普通安装由 Host 自动完成，公开包不包含开发脚本。

详见 [发布流程](RELEASING.md) 和 [工具发布与 UI 修复记录](PUBLICATION-REVIEW.zh.md)。
