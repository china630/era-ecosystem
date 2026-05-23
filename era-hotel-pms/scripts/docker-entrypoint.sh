#!/bin/sh
set -e

cd /app

if [ -f package.json ]; then
  if [ ! -d node_modules/.prisma ]; then
    npx prisma generate 2>/dev/null || true
  fi
  npx prisma migrate deploy
  if [ "$RUN_SEED" = "true" ] && [ "$NODE_ENV" != "production" ]; then
    npm run db:seed 2>/dev/null || true
  fi
fi

exec "$@"
