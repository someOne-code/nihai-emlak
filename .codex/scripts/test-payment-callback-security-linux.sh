#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

source .codex/scripts/_ensure-node-linux.sh

node --experimental-strip-types --experimental-specifier-resolution=node --test tests/payment-callback-security.test.mts
