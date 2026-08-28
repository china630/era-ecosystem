#!/bin/sh
# Control-plane entrypoint. Prisma clients are baked in the image — do not
# `prisma generate` or `npx prisma` at boot (Nightly CPU contention; npx hangs
# downloading CLI). migrate-all.sh already applied schema before `up`.
set -e
cd /app

# Workspace hoist puts prisma at /app/node_modules, not packages/*/node_modules.
prisma_cli() {
  if [ -f /app/node_modules/prisma/build/index.js ]; then
    echo /app/node_modules/prisma/build/index.js
  elif [ -f "$1/node_modules/prisma/build/index.js" ]; then
    echo "$1/node_modules/prisma/build/index.js"
  fi
}

migrate_pkg() {
  pkg="$1"
  label="$2"
  if [ "${SKIP_PRISMA_MIGRATE:-0}" = "1" ]; then
    return 0
  fi
  if [ ! -f "$pkg/prisma/schema.prisma" ]; then
    return 0
  fi
  cli="$(prisma_cli "$pkg")"
  if [ -n "$cli" ]; then
    (cd "$pkg" && node "$cli" migrate deploy)
  elif [ -x "$pkg/node_modules/.bin/prisma" ]; then
    (cd "$pkg" && ./node_modules/.bin/prisma migrate deploy)
  else
    echo "[entrypoint] WARN: prisma CLI missing in $pkg ($label) — skip migrate" >&2
    return 0
  fi
}

if ! migrate_pkg packages/database "control-plane"; then
  echo "[entrypoint] WARN: control-plane migrate deploy failed" >&2
fi
if ! migrate_pkg packages/mdm-database "MDM"; then
  echo "[entrypoint] WARN: MDM migrate deploy failed — register-org will 500 until era_mdm is migrated" >&2
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
