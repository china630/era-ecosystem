#!/bin/sh
set -e
cd /app

if [ -f prisma/schema.prisma ]; then
  if [ ! -d node_modules/.prisma ]; then
    npx prisma generate 2>/dev/null || true
  fi
  npx prisma db push 2>/dev/null || true
  if [ "$RUN_SEED" = "true" ]; then
    npm run db:seed 2>/dev/null || true
  fi
fi

exec "$@"
