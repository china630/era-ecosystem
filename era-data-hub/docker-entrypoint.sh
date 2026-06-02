#!/bin/sh
set -e
if [ -n "$DATABASE_URL" ]; then
  echo "[data-hub] applying migrations..."
  npm run db:migrate:deploy -w @era/data-hub-database 2>/dev/null || true
  npm run db:seed -w @era/data-hub-database 2>/dev/null || true
fi
exec "$@"
