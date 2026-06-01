#!/bin/sh
set -e
cd /app

if [ -f packages/database/prisma/schema.prisma ]; then
  npm run db:generate -w @era365/database 2>/dev/null || true
  npm run db:migrate:deploy -w @era365/database 2>/dev/null || true
fi

if [ -f packages/mdm-database/prisma/schema.prisma ]; then
  npm run db:generate -w @era365/mdm-database 2>/dev/null || true
  if ! npm run db:migrate:deploy -w @era365/mdm-database; then
    echo "[entrypoint] WARN: MDM migrate deploy failed — register-org will 500 until era_mdm is migrated" >&2
  fi
fi

if [ "$1" = "start" ]; then
  API_PORT="${API_PORT:-4000}"
  WEB_PORT="${WEB_PORT:-3000}"
  STANDALONE="apps/web/.next/standalone/apps/web"
  if [ -d apps/web/.next/static ] && [ ! -d "${STANDALONE}/.next/static" ]; then
    mkdir -p "${STANDALONE}/.next"
    cp -r apps/web/.next/static "${STANDALONE}/.next/static"
  fi
  if [ -d apps/web/public ] && [ ! -d "${STANDALONE}/public" ]; then
    cp -r apps/web/public "${STANDALONE}/public"
  fi
  PORT="${API_PORT}" node apps/api/dist/main.js &
  if [ -f apps/web/.next/standalone/apps/web/server.js ]; then
    export PORT="${WEB_PORT}"
    export HOSTNAME=0.0.0.0
    exec node apps/web/.next/standalone/apps/web/server.js
  fi
  if [ -f apps/web/.next/standalone/server.js ]; then
    export PORT="${WEB_PORT}"
    export HOSTNAME=0.0.0.0
    exec node apps/web/.next/standalone/server.js
  fi
  export PORT="${WEB_PORT}"
  export HOSTNAME=0.0.0.0
  exec npm run start -w @era365/web
fi

exec "$@"
