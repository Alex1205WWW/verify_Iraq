#!/bin/sh
set -e

# The volume starts empty on a brand new machine. Create the upload directory
# and, only if there is no database yet, build one and seed it.
#
# The guard matters: without it every redeploy would wipe the demo data, and
# on a real deployment it would wipe the client's evidence.

mkdir -p "${UPLOADS_DIR:-/data/uploads}"

DB_FILE="$(printf '%s' "${DATABASE_URL#file:}")"

if [ ! -f "$DB_FILE" ]; then
  echo "[entrypoint] No database at $DB_FILE — creating and seeding."
  npx prisma db push --skip-generate
  node prisma/seed.mjs
else
  echo "[entrypoint] Database found at $DB_FILE — leaving it alone."
  # Applies any schema change from a new build without touching the rows.
  npx prisma db push --skip-generate
fi

exec "$@"
