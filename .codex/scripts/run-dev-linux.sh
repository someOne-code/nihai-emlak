#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
source .codex/scripts/_ensure-node-linux.sh

npx next dev --hostname 0.0.0.0 --port 3000
