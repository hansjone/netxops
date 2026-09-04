#!/usr/bin/env bash
set -euo pipefail
TOKEN="${1:-}"
if [[ -z "$TOKEN" ]]; then
  echo "usage: $0 <NETX_API_TOKEN>" >&2
  exit 1
fi
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
mkdir -p "$DSH_HOME"
PATH_FILE="$DSH_HOME/.credentials.yaml"
ESC=${TOKEN//\'/\'\'}

if [[ ! -f "$PATH_FILE" ]]; then
  cat >"$PATH_FILE" <<EOF
version: 1

refs:
  NETX_API_TOKEN: '$ESC'
EOF
  echo "Created $PATH_FILE with NETX_API_TOKEN"
  exit 0
fi

if grep -qE '^[[:space:]]*NETX_API_TOKEN[[:space:]]*:' "$PATH_FILE"; then
  # portable-ish in-place replace
  tmp="$(mktemp)"
  sed -E "s|^([[:space:]]*NETX_API_TOKEN[[:space:]]*:[[:space:]]*).*$|\1'$ESC'|" "$PATH_FILE" >"$tmp"
  mv "$tmp" "$PATH_FILE"
else
  if grep -qE '^refs[[:space:]]*:' "$PATH_FILE"; then
    tmp="$(mktemp)"
    awk -v tok="$ESC" '
      BEGIN{done=0}
      /^refs[[:space:]]*:/ && !done { print; print "  NETX_API_TOKEN: '\''" tok "'\''"; done=1; next }
      { print }
    ' "$PATH_FILE" >"$tmp"
    mv "$tmp" "$PATH_FILE"
  else
    printf '\nrefs:\n  NETX_API_TOKEN: '\''%s'\''\n' "$ESC" >>"$PATH_FILE"
  fi
fi
echo "Updated NETX_API_TOKEN in $PATH_FILE"
echo "If dsh is running, wait for credential reload or restart dsh web."
