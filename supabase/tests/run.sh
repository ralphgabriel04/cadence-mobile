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

# A deliberate break (POST_MIGRATION_SQL) must never run where results gate a merge.
if [ -n "${POST_MIGRATION_SQL:-}" ] && { [ -n "${CI:-}" ] || [ -n "${GITHUB_ACTIONS:-}" ]; }; then
  echo "POST_MIGRATION_SQL is refused when CI or GITHUB_ACTIONS is set" >&2
  exit 2
fi

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

# Optional: a SQL file applied after the migrations. Used only by
# negative-control.sh to break a policy on purpose; unset in normal runs and CI.
if [ -n "${POST_MIGRATION_SQL:-}" ]; then
  printf '    (extra) %s\n' "$(basename "$POST_MIGRATION_SQL")"
  psql_file "$POST_MIGRATION_SQL"
fi

echo "==> running tests"
# Lexical order matters: 90_ creates the rec() helper and the shared fixtures
# that later files build on.
for t in "$HERE"/9*.sql; do
  printf '    %s\n' "$(basename "$t")"
  # `|| true`: under `set -o pipefail`, a grep that filters out every line exits
  # 1, which would abort the run through `set -e` even though nothing failed.
  docker exec -i "$CONTAINER" psql -U postgres -d cadence -v ON_ERROR_STOP=1 -q -f - < "$t" 2>&1 \
    | { grep -vE '^(NOTICE|CREATE|INSERT|DO|UPDATE [0-9]|SELECT [0-9])' || true; }
done

docker exec "$CONTAINER" psql -U postgres -d cadence -q -c \
  "SELECT CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS r, name,
          CASE WHEN passed THEN '' ELSE detail END AS detail
     FROM test_results ORDER BY n;"

# Non-zero exit if anything failed, so CI can gate on it.
failed=$(docker exec "$CONTAINER" psql -U postgres -d cadence -tAc \
  "SELECT count(*) FROM test_results WHERE passed IS NOT TRUE")
# A suite that silently ran far fewer cases than expected must not look green.
MIN_TESTS="${MIN_TESTS:-150}"
ran=$(docker exec "$CONTAINER" psql -U postgres -d cadence -tAc "SELECT count(*) FROM test_results")
if [ "$ran" -lt "$MIN_TESTS" ]; then
  echo "FAILED: only $ran test(s) ran, expected at least $MIN_TESTS" >&2
  exit 1
fi
if [ "$failed" != "0" ]; then
  echo "FAILED: $failed test(s)" >&2
  exit 1
fi
echo "All tests passed."
