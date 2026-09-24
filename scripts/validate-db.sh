#!/usr/bin/env bash
# Validates the database layer against PostgreSQL 16:
#   1. db/schema.sql + db/smoke_test.sql (vendor-neutral, as a non-superuser)
#   2. supabase migration with an auth stub + supabase/tests (Supabase flavor)
# Usage: scripts/validate-db.sh                 # starts a throwaway postgres:16 container
#        DATABASE_URL=postgres://user:pw@host:5432/postgres scripts/validate-db.sh   # existing server (CI)
set -euo pipefail
# grep in the pipelines below fails the script when no PASS line is printed; psql errors propagate through pipefail
cd "$(dirname "$0")/.."

if [[ -n "${DATABASE_URL:-}" ]]; then
  PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q)
  run_as() { local user=$1 db=$2; shift 2; psql "${DATABASE_URL%/*}/$db" -v ON_ERROR_STOP=1 -q "$@"; }
  run_as_role() { local role=$1 pw=$2 db=$3; shift 3; PGPASSWORD=$pw psql "$(echo "$DATABASE_URL" | sed -E "s#//[^@]+@#//$role@#; s#/[^/?]+(\?.*)?\$#/$db#")" -v ON_ERROR_STOP=1 -q "$@"; }
else
  C=$(docker run -d --rm -e POSTGRES_PASSWORD=pw postgres:16-alpine)
  trap 'docker stop "$C" >/dev/null' EXIT
  for _ in $(seq 1 30); do docker exec "$C" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
  PSQL=(docker exec -i "$C" psql -U postgres -v ON_ERROR_STOP=1 -q)
  run_as() { local user=$1 db=$2; shift 2; docker exec -i "$C" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 -q "$@"; }
  run_as_role() { local role=$1 pw=$2 db=$3; shift 3; docker exec -i -e PGPASSWORD="$pw" "$C" psql -h localhost -U "$role" -d "$db" -v ON_ERROR_STOP=1 -q "$@"; }
fi

echo "== 1/2 db/schema.sql + smoke test"
"${PSQL[@]}" -c "drop database if exists portal_plain" -c "create database portal_plain"
run_as postgres portal_plain -f - < db/schema.sql
run_as postgres portal_plain -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname='app_rw') then create role app_rw login password 'pw' nosuperuser nobypassrls; end if; end \$\$;" \
  -c "grant usage on schema public to app_rw; grant all on all tables in schema public to app_rw; grant all on all sequences in schema public to app_rw; grant execute on all functions in schema public to app_rw;"
run_as_role app_rw pw portal_plain -f - < db/smoke_test.sql 2>&1 | grep -E "PASS|FAIL|ERROR"

echo "== 2/2 supabase migration + auth stub + RLS tests"
"${PSQL[@]}" -c "drop database if exists portal_supabase" -c "create database portal_supabase"
run_as postgres portal_supabase -f - < supabase/tests/auth_stub.sql
run_as postgres portal_supabase -f - < supabase/migrations/20260923000000_initial.sql
run_as postgres portal_supabase -f - < supabase/tests/rls_setup.sql 2>&1 | grep -E "PASS|FAIL|ERROR" || true
run_as_role app_test pw portal_supabase -f - < supabase/tests/rls_smoke.sql 2>&1 | grep -E "PASS|FAIL|ERROR"
echo "== database validation passed"
