#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

source .codex/scripts/_ensure-node-linux.sh

node --experimental-strip-types --experimental-specifier-resolution=node --test tests/payment-callback-security.test.mts tests/checkout-init-route-helper.test.mts tests/checkout-init-route.test.mts tests/payment-callback-route.test.mts tests/csp-policy.test.mts tests/payload-security.test.mts
