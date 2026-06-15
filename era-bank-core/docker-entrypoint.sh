#!/bin/sh
set -e
cd /app

if [ -f packages/database/prisma/schema.prisma ]; then
  npm run db:migrate:deploy -w @era/bank-core-database
  if [ "$RUN_SEED" = "true" ]; then
    npm run db:seed -w @era/bank-core-database
  fi
fi

exec "$@"
