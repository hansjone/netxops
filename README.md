# Netx Ops for DeepSeek Harness

Network operations, topology and business monitoring tools for DeepSeek Harness Desktop and Web. Publish tools and their skills to Netx Ops, selected presets, or all presets; revoke them at any time.

## Install

In Harness **Plugins → Add plugin**, enter `github:hansjone/netxops`, or the absolute path to a released `dsh-netxops-<version>.tgz`. A release tarball is recommended for a fixed, tested version and avoids downloading from GitHub during installation.

For the Web CLI:

```sh
dsh plugin --profile web add github:hansjone/netxops
dsh web
```

Only Netx Ops is required. IM delivery and scheduling are optional, separate plugins. Users do not need Bun, Python, a local source checkout, or a build step; runtime JS and skills are included. Harness supplies its own internal packages and React.

See the [installation and troubleshooting guide](docs/INSTALL.md).

## Configure

1. Open **Settings → Plugins → Netx Ops** and enter your Netx API URL and token.
2. Choose each capability group's target presets. The default enables operations and business monitoring in Netx Ops only; topology and publication to all presets start disabled.
3. After installation or upgrade, restart the relevant Desktop or Web Host once and select **Netx Ops** for a new session.

Publication switches and preset selection save automatically. Connection fields, model language, alarm settings and manually entered knowledge-base paths use **Save / Discard**, shown when a draft changes. Choosing a knowledge-base directory through the picker saves that path automatically.

The master publication switch removes all plugin-managed Netx tools and skills while retaining selections. Subsequent publication changes apply on the next model request without restarting. API access requires a reachable Netx service and token permissions matching the requested tools.

Optional features include alarm delivery to a Harness session or IM, knowledge-base skills and local memory, and downloading this Host's persisted sessions as a ZIP. See [knowledge-base configuration](docs/KNOWLEDGE_BASE.md) and the [tool map](docs/TOOL_MAP.md).

## Development and release

```sh
pnpm install --frozen-lockfile --ignore-scripts
bun run bundle
bun run release:check
bun run test:release
bun run release:pack
```

Development requires Node.js 22, pnpm 11.7 and Bun 1.3.13 or later. Building and package installation tests use only public development dependencies. Full Harness integration tests and type checking additionally need a local Harness runtime; see [maintainer instructions](docs/RELEASING.md).

Release checks detect stale or missing bundles, undeclared runtime dependencies, invalid metadata and missing skills. Tests install the actual npm tarball offline in an isolated profile. CI repeats the package checks on Windows, macOS and Linux.

Skills are maintained in the sibling `netx/skills` repository and copied into this package before release. Published installations use the bundled skill files; a source checkout can use the sibling repository or an explicit `NETX_SKILLS_ROOT`.

Implementation and UI validation details: [Chinese review](docs/PUBLICATION-REVIEW.zh.md).

## License

MIT
