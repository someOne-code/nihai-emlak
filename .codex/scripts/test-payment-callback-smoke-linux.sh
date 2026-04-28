#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

source .codex/scripts/_ensure-node-linux.sh

start_supabase_if_needed() {
  local log_file="$1"

  if npx supabase start -x "$EXCLUDES" --yes >"$log_file" 2>&1; then
    return 0
  fi

  if grep -Fq "supabase start is already running" "$log_file"; then
    return 0
  fi

  cat "$log_file" >&2
  return 1
}

wait_for_supabase_api() {
  local api_url="$1"
  local health_url="${api_url%/}/auth/v1/health"

  for _ in $(seq 1 30); do
    if node -e "fetch(process.argv[1]).then((response) => process.exit(response.status < 500 ? 0 : 1)).catch(() => process.exit(1))" "$health_url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done

  echo "Supabase API did not become ready: $health_url" >&2
  return 1
}

# Keep required callback dependencies (db + kong + auth + postgrest),
# skip heavy services not needed for this smoke test.
EXCLUDES="realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor,mailpit"
start_supabase_if_needed /tmp/supabase_start_payment_callback_smoke.log
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

wait_for_supabase_api "$NEXT_PUBLIC_SUPABASE_URL"

node --experimental-strip-types --experimental-specifier-resolution=node --test tests/payment-callback-smoke.test.mts
