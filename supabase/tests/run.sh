#!/usr/bin/env bash
# Spins up a throwaway Postgres, applies shim + migration + seed, runs rls_test.sql.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | tail -1)"
DATA="$(mktemp -d)"
PORT=54329
"$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA" -l "$DATA/log" start >/dev/null
trap '"$PGBIN/pg_ctl" -D "$DATA" stop >/dev/null; rm -rf "$DATA"' EXIT
PSQL=(psql -h "$DATA" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -t -o /dev/null)
"${PSQL[@]}" -f "$HERE/shim.sql"
for f in "$HERE"/../migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f "$HERE/../seed.sql"
"${PSQL[@]}" -f "$HERE/rls_test.sql"
