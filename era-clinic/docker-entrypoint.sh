#!/bin/sh
set -e
cd /app

if [ -f prisma/schema.prisma ]; then
  if [ ! -d node_modules/.prisma ]; then
    npx prisma generate 2>/dev/null || true
  fi
  if command -v psql >/dev/null 2>&1 && [ -f ./scripts/docker-migrate-deploy.mjs ]; then
    node ./scripts/docker-migrate-deploy.mjs 2>/dev/null || npx prisma db push 2>/dev/null || true
  else
    npx prisma db push 2>/dev/null || true
  fi
  if [ "$RUN_SEED" = "true" ]; then
    echo "[entrypoint] RUN_SEED=true → npm run db:seed (satellite templates; not db:seed:vnext)"
    npm run db:seed || echo "[entrypoint] WARN: db:seed failed" >&2
  fi
fi

exec "$@"
