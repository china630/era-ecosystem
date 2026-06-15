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
    npm run db:seed 2>/dev/null || npm run db:seed:vnext 2>/dev/null || true
  fi
fi

exec "$@"
