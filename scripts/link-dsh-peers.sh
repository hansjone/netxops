#!/usr/bin/env bash
# Link DSH peer packages into this checkout for local `dsh plugin add <path>` / `link:`.
# See link-dsh-peers.ps1 for why.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
SRC_ROOT="$DSH_HOME/profiles/node_modules/@deepseek-ai"
DST_ROOT="$ROOT/node_modules/@deepseek-ai"
PEERS=(schemastery cordis dsh-credentials dsh-settings dsh-mcp-client dsh-tools)

if [[ ! -d "$SRC_ROOT" ]]; then
  echo "DSH installation fallback missing: $SRC_ROOT" >&2
  echo "Run dsh web once so dsh heals profiles/node_modules." >&2
  exit 1
fi

mkdir -p "$DST_ROOT"
for name in "${PEERS[@]}"; do
  src="$SRC_ROOT/$name"
  dst="$DST_ROOT/$name"
  if [[ ! -e "$src" ]]; then
    echo "Peer not found: $src" >&2
    exit 1
  fi
  rm -rf "$dst"
  ln -s "$src" "$dst"
  echo "linked @deepseek-ai/$name -> $src"
done
echo "Done. Re-run: dsh web"
