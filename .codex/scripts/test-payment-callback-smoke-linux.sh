#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

source .codex/scripts/_ensure-node-linux.sh

# Keep required callback dependencies (db + kong + auth + postgrest),
# skip heavy services not needed for this smoke test.
EXCLUDES="realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor,mailpit"
npx supabase start -x "$EXCLUDES" --yes >/tmp/supabase_start_payment_callback_smoke.log 2>&1
npx supabase db reset >/tmp/supabase_db_reset_payment_callback_smoke.log 2>&1

STATUS_ENV="$(npx supabase status -o env)"
while IFS= read -r line; do
  if [[ "$line" =~ ^[A-Z0-9_]+= ]]; then
    key="${line%%=*}"
    value="${line#*=}"
    value="${value#\"}"
    value="${value%\"}"
    export "$key=$value"
  fi
done <<< "$STATUS_ENV"

# supabase status -o env exports ANON_KEY in older CLI versions; map it
PUBLISHABLE_KEY="${PUBLISHABLE_KEY:-${ANON_KEY:-}}"

if [[ -z "${API_URL:-}" || -z "${PUBLISHABLE_KEY:-}" || -z "${SERVICE_ROLE_KEY:-}" ]]; then
  echo "Supabase env values are missing (API_URL/PUBLISHABLE_KEY or ANON_KEY/SERVICE_ROLE_KEY)." >&2
  exit 1
fi

export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export ISBANK_STORE_KEY="${ISBANK_STORE_KEY:-SMOKE_TEST_ISBANK_STORE_KEY}"
export ISBANK_CLIENT_ID="${ISBANK_CLIENT_ID:-7000679}"

node --experimental-strip-types --experimental-specifier-resolution=node --test tests/payment-callback-smoke.test.mts
