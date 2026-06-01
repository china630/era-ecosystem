#!/bin/sh
set -e
cd /app

if [ -f packages/database/prisma/schema.prisma ]; then
  npm run db:migrate:deploy -w @erafinance/database
fi

exec "$@"
