#!/usr/bin/env bash
# ============================================================================
# Regenerates src/types/database.ts from supabase/migrations/*.sql.
#
#   pnpm gen:types
#
# Applies the migrations to a disposable PostgreSQL container, introspects the
# result, and pipes it through scripts/gen-db-types.mjs. Needs Docker. Never
# connects to a Supabase project, so it is safe to run at any time.
# ============================================================================
set -euo pipefail

CONTAINER=cadence-typegen
IMAGE=postgres:17-alpine
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$HERE/.."
OUT="$ROOT/src/types/database.ts"

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> starting $IMAGE" >&2
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=test -e POSTGRES_DB=cadence "$IMAGE" >/dev/null

for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres -d cadence >/dev/null 2>&1 && break
  sleep 1
done

apply() { docker exec -i "$CONTAINER" psql -U postgres -d cadence -v ON_ERROR_STOP=1 -q -f - < "$1"; }

echo "==> applying harness and migrations" >&2
apply "$ROOT/supabase/tests/00_harness.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do apply "$f"; done

echo "==> introspecting" >&2
# Emits pipe-delimited records the generator understands:
#   ENUM|<type>|<value>
#   COLUMN|<table>|<column>|<udt>|<is_nullable>|<has_default>|<is_generated>
#   FUNCTION|<name>
INTROSPECT=$(cat <<'SQL'
SELECT 'ENUM|' || t.typname || '|' || e.enumlabel
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
  JOIN pg_namespace n ON n.oid = t.typnamespace
 WHERE n.nspname = 'public'
 ORDER BY t.typname, e.enumsortorder;

SELECT 'COLUMN|' || c.table_name || '|' || c.column_name || '|' || c.udt_name
       || '|' || c.is_nullable
       || '|' || CASE WHEN c.column_default IS NOT NULL THEN 't' ELSE 'f' END
       || '|' || c.is_generated
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
 WHERE c.table_schema = 'public'
   AND t.table_type = 'BASE TABLE'
 ORDER BY c.table_name, c.ordinal_position;

SELECT 'FUNCTION|' || p.proname
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
 ORDER BY p.proname;
SQL
)

docker exec -i "$CONTAINER" psql -U postgres -d cadence -tAq -f - <<< "$INTROSPECT" \
  | node "$HERE/gen-db-types.mjs" > "$OUT"

echo "==> wrote $OUT" >&2
wc -l < "$OUT" | xargs printf '    %s lines\n' >&2
