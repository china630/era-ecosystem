#!/bin/sh
set -e
cd /app

if [ -f packages/database/prisma/schema.prisma ]; then
  npm run db:generate -w @era365/database 2>/dev/null || true
  npx prisma migrate deploy --schema packages/database/prisma/schema.prisma 2>/dev/null || true
fi

if [ "$1" = "start" ]; then
  PORT=4100 node apps/api/dist/main.js &
  export PORT=3100
  export HOSTNAME=0.0.0.0
  exec npm run start -w @era365/web
fi

exec "$@"
