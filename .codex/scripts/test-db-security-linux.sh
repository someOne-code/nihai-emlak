#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

source .codex/scripts/_ensure-node-linux.sh

# Keep local startup light for DB-focused tests.
EXCLUDES="gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor"
npx supabase start -x "$EXCLUDES" --yes >/tmp/supabase_start_test_db_security.log 2>&1
npx supabase db reset >/tmp/supabase_db_reset_test_db_security.log 2>&1

DB_CONTAINER="supabase_db_$(basename "$REPO_ROOT")"

if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  DB_CONTAINER="$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -n 1 || true)"
fi

if [ -z "$DB_CONTAINER" ]; then
  echo "No running Supabase DB container found after startup." >&2
  exit 1
fi

for sql_test in "$REPO_ROOT"/tests/sql/*.sql; do
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$sql_test" >/tmp/"$(basename "$sql_test").log"
done

echo "test-db-security: ok"
