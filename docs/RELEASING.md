# Public release checklist

The public package ships precompiled JS, preset overlays, skills, metadata and user documentation. It has no install/prepare/prepack build hook and no third-party runtime dependencies. Optional peer packages are supplied by Harness. Publish a tested tarball rather than asking users to build or link the repository.

## Prepare the source

Use Node.js 22, pnpm 11.7 and Bun >=1.3.13. Update `package.json.version`, synchronize canonical skills if changed, then run:

```sh
pnpm install --frozen-lockfile --ignore-scripts
bun run bundle
bun run release:check
bun run test:release
```

The workspace disables automatic peer installation so a fresh source checkout does not fetch private Harness packages. `bundle` does not generate a preset from a developer's local Host: the installed plugin composes it from the user's running standard preset. `gen:preset-patch` is an explicit local debugging command and its generated snapshot is excluded from the public package.

The build records source inputs and output hashes in `.release-build.json`. Commit this file and all eight `lib/*.js` exports with source changes. `release:check` fails when outputs are missing, modified or stale, or when a package resource or runtime contract is incomplete. New exports must also be included in `files` and package tests.

## Check Harness behavior

For full integration and type checks, first start a locally installed Harness and link one coherent runtime:

```sh
node scripts/link-dsh-peers.mjs --profile desktop
bun run typecheck
bun test test tests
```

Use `web` when testing the Web runtime. Full tests include the current official volatile Schema implementation, real Cordis scopes, publication changes, UI settings transport, preset preservation and fresh commented profile patches.

`test:release` creates the actual npm tarball and installs it offline into a temporary profile with spaces and Chinese characters. Lifecycle scripts are allowed in this test, proving normal installation needs no build. It verifies all exports, client registration, bundled skills and metadata, and excludes source, tests, local config and developer scripts. When Harness is installed locally, it also activates that installed copy using actual Host peers and verifies tool/skill mounting and clean unload. The fixture never edits the user's profile or credentials and never calls a Netx production API.

CI runs package checks, builds and offline installation on Windows, macOS and Linux. CI without Harness checks package installation and client registration; Host activation is covered by the local integration suite. Wait for the platform jobs to pass before publishing.

## Create and distribute

```sh
bun run release:pack
```

This verifies the build, uses the same npm packer as the installation tests, and creates `dsh-netxops-<version>.tgz` plus a `.sha256` checksum. Install this exact file into a separate Desktop/Web profile before announcing a release. Check the plugin version, settings card, Netx Ops preset, tool availability and revocation. Test API connectivity with an appropriate test service/token, plus any optional IM delivery configuration that the release changes.

Upload the verified tarball to the version's GitHub Release or publish it to npm as a separate maintainer action. `prepublishOnly` protects publishing from the source tree; `npm publish <tarball>` must use the tarball already checked above. Do not publish merely because a local directory boots successfully.

Public install instructions should use that version's tarball or a fixed repository tag. Keep companion IM/cron plugins optional. A local filesystem path, an absolute developer directory and peer junctions are development aids, not public distribution dependencies.
