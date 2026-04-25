#!/usr/bin/env bash
# Applies all SQL files in supabase/migrations/ via psql.
# Reads SUPABASE_DB_URL from apps/web/.env.local.
# Run via `pnpm db:migrate`.
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE="apps/web/.env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "$ENV_FILE missing. Run \`pnpm setup:env\` first." >&2
  exit 1
fi

set -a
. "$ENV_FILE"
set +a

: "${SUPABASE_DB_URL:?Add SUPABASE_DB_URL=postgres://... to apps/web/.env.local (Project Settings → Database → Connection string)}"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install with \`brew install libpq\` and link it." >&2
  exit 1
fi

for f in supabase/migrations/*.sql; do
  echo "Applying $f"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "All migrations applied."
