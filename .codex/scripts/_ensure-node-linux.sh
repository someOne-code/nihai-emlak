#!/usr/bin/env bash
set -euo pipefail

ensure_node_linux() {
  local node_path

  node_path="$(command -v node || true)"
  if [[ -n "$node_path" && "$node_path" != /mnt/c/* ]]; then
    return 0
  fi

  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    . "$NVM_DIR/nvm.sh"
  fi

  if command -v nvm >/dev/null 2>&1; then
    nvm use --silent 22 >/dev/null 2>&1 || nvm use --silent default >/dev/null 2>&1 || true
  fi

  node_path="$(command -v node || true)"
  if [[ -z "$node_path" || "$node_path" == /mnt/c/* ]]; then
    cat >&2 <<'EOF'
Node.js is not available in this WSL shell.
Install/use Node 22 with nvm, then retry:
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install 22
  nvm use 22
EOF
    return 1
  fi
}

ensure_node_linux
