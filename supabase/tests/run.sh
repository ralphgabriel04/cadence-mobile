#!/usr/bin/env bash
# ============================================================================
# Runs the RLS and trigger test suite against a disposable PostgreSQL container.
#
#   ./supabase/tests/run.sh
#
# Needs Docker. Touches nothing outside the throwaway container, so it is safe
# to run at any time -- in particular it never connects to a Supabase project.
#
# Why a plain postgres image rather than `supabase start`: the suite only needs
# the SQL surface, and a bare container starts in about four seconds instead of
# pulling the whole Supabase stack. 00_harness.sql supplies the few Supabase
# objects the migrations depend on (the auth schema, auth.uid(), and the anon /
# authenticated / service_role roles).
#
# IMPORTANT: the harness stubs auth.uid() with a session GUC, so it verifies the
# POLICY LOGIC, not Supabase's JWT handling. A policy that passes here can still
# be reached with an unexpected identity if the client passes the wrong token.
# ============================================================================
set -euo pipefail

CONTAINER=cadence-sqltest
IMAGE=postgres:17-alpine
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS="$HERE/../migrations"

cleanup() {
  if [ "${KEEP_CONTAINER:-0}" != "1" ]; then
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  else
    echo "Container kept: docker exec -it $CONTAINER psql -U postgres -d cadence"
  fi
}
trap cleanup EXIT

echo "==> starting $IMAGE"
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=test -e POSTGRES_DB=cadence \
  "$IMAGE" >/dev/null

for _ in $(seq 1 60); do
  # Over TCP on purpose: during initdb the image runs a TEMPORARY server that
  # listens on the Unix socket only, so a socket check can pass just before that
  # server stops and the real one starts (seen in CI on 2026-10-22).
  if docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -U postgres -d cadence >/dev/null 2>&1; then break; fi
  sleep 1
done

psql_file() {
  docker exec -i "$CONTAINER" psql -U postgres -d cadence -v ON_ERROR_STOP=1 -q -f - < "$1"
}

echo "==> applying harness and migrations"
psql_file "$HERE/00_harness.sql"
for f in "$MIGRATIONS"/*.sql; do
  printf '    %s\n' "$(basename "$f")"
  psql_file "$f"
done

echo "==> running tests"
docker exec -i "$CONTAINER" psql -U postgres -d cadence -q -f - \
  < "$HERE/90_rls_tests.sql" 2>&1 \
  | grep -vE '^(NOTICE|CREATE|INSERT|DO|SELECT [0-9])'

# Non-zero exit if anything failed, so CI can gate on it.
failed=$(docker exec "$CONTAINER" psql -U postgres -d cadence -tAc \
  "SELECT count(*) FROM test_results WHERE NOT passed")
if [ "$failed" != "0" ]; then
  echo "FAILED: $failed test(s)" >&2
  exit 1
fi
echo "All tests passed."
