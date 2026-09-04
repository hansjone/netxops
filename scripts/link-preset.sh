#!/usr/bin/env bash
# Install presets/netxops into $DSH_HOME/.agent-presets (copy, not symlink).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/presets/netxops"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
DEST_PARENT="$DSH_HOME/.agent-presets"
DEST="$DEST_PARENT/netxops"

if [[ ! -f "$SRC/agent.cordis.yml" ]]; then
  echo "Missing preset dir: $SRC" >&2
  exit 1
fi
mkdir -p "$DEST_PARENT"
rm -rf "$DEST"
cp -R "$SRC" "$DEST"
date -u +%Y-%m-%dT%H:%M:%SZ > "$DEST/.dsh-netxops-managed"
echo "Installed $DEST"
echo "Open Settings → Agent presets → Custom → Netx Ops"
