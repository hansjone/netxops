#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$REPO_ROOT/presets/netxops"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
TARGET_PARENT="$DSH_HOME/.agent-presets"
TARGET="$TARGET_PARENT/netxops"

if [[ ! -d "$SOURCE" ]]; then
  echo "Missing preset dir: $SOURCE" >&2
  exit 1
fi
mkdir -p "$TARGET_PARENT"
if [[ -e "$TARGET" || -L "$TARGET" ]]; then
  rm -rf "$TARGET"
fi
ln -s "$SOURCE" "$TARGET"
echo "Linked $TARGET -> $SOURCE"
echo "Restart dsh / open a new session and select preset 'netxops' (Netx Ops)."
