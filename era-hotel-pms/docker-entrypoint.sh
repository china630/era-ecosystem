#!/bin/sh
set -e

cd /app

# Migrations: psql-based deploy (standalone image lacks full Prisma CLI deps).
if [ -f package.json ] && [ "${SKIP_PRISMA_MIGRATE:-0}" != "1" ]; then
  if [ ! -d node_modules/.prisma ]; then
    if [ -f ./node_modules/prisma/build/index.js ]; then
      node ./node_modules/prisma/build/index.js generate 2>/dev/null || true
    elif [ -x ./node_modules/.bin/prisma ]; then
      ./node_modules/.bin/prisma generate 2>/dev/null || true
    fi
  fi
  if command -v psql >/dev/null 2>&1 && [ -f ./scripts/docker-migrate-deploy.mjs ]; then
    if ! node ./scripts/docker-migrate-deploy.mjs; then
      echo "[entrypoint] WARN: migrate deploy failed — from repo root:" >&2
      echo "  cd era-hotel-pms && DATABASE_URL=... npx prisma migrate deploy" >&2
      echo "  or: npm run bootstrap:local -- --migrate-satellites" >&2
    fi
  elif [ -f ./node_modules/prisma/build/index.js ]; then
    if ! node ./node_modules/prisma/build/index.js migrate deploy; then
      echo "[entrypoint] WARN: prisma migrate deploy failed (see above)" >&2
    fi
  fi
  if [ "$RUN_SEED" = "true" ] && [ "$NODE_ENV" != "production" ]; then
    npm run db:seed 2>/dev/null || true
  fi
fi

exec "$@"
