#!/bin/sh
set -e

cd /app

if [ -f package.json ]; then
  if [ ! -d node_modules/.prisma ]; then
    npx prisma generate 2>/dev/null || true
  fi
  npx prisma migrate deploy
  if [ "$RUN_SEED" = "true" ] && [ "$NODE_ENV" != "production" ]; then
    # Reference seed only. Wipe: npm run db:seed:demo on host.
    echo "[entrypoint] RUN_SEED=true → npm run db:seed"
    npm run db:seed 2>/dev/null || true
  fi
fi

exec "$@"
