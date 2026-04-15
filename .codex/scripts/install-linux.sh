#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
source .codex/scripts/_ensure-node-linux.sh

npm install
