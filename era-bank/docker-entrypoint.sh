#!/bin/sh
set -e
cd /app

if [ -f prisma/schema.prisma ]; then
  if [ ! -d node_modules/.prisma ]; then
    npx prisma generate 2>/dev/null || true
  fi
  npx prisma db push 2>/dev/null || true
  if [ "$RUN_SEED" = "true" ]; then
    # Role templates only (needs ERA_BANK_ORGANIZATION_ID). Demo users: db:seed:demo.
    echo "[entrypoint] RUN_SEED=true → npm run db:seed"
    npm run db:seed 2>/dev/null || true
  fi
fi

exec "$@"
