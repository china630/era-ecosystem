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
  PLATFORM_WEB_PORT="${PLATFORM_WEB_PORT:-3001}"
  STANDALONE="apps/web/.next/standalone/apps/web"
  PLATFORM_STANDALONE="apps/platform-web/.next/standalone/apps/platform-web"
  if [ -d apps/web/.next/static ] && [ ! -d "${STANDALONE}/.next/static" ]; then
    mkdir -p "${STANDALONE}/.next"
    cp -r apps/web/.next/static "${STANDALONE}/.next/static"
  fi
  if [ -d apps/web/public ] && [ ! -d "${STANDALONE}/public" ]; then
    cp -r apps/web/public "${STANDALONE}/public"
  fi
  if [ -d apps/platform-web/.next/static ] && [ ! -d "${PLATFORM_STANDALONE}/.next/static" ]; then
    mkdir -p "${PLATFORM_STANDALONE}/.next"
    cp -r apps/platform-web/.next/static "${PLATFORM_STANDALONE}/.next/static"
  fi
  if [ -d apps/platform-web/public ] && [ ! -d "${PLATFORM_STANDALONE}/public" ]; then
    cp -r apps/platform-web/public "${PLATFORM_STANDALONE}/public"
  fi
  api_main="apps/api/dist/main.js"
  if [ ! -f "$api_main" ]; then
    api_main="apps/api/dist/era-orchestrator/apps/api/src/main.js"
  fi
  if [ ! -f "$api_main" ]; then
    echo "[entrypoint] ERROR: Nest API entry not found (expected dist/main.js)" >&2
    exit 1
  fi
  PORT="${API_PORT}" node "$api_main" &
  PLATFORM_SERVER=""
  for candidate in \
    "${PLATFORM_STANDALONE}/server.js" \
    "apps/platform-web/.next/standalone/era-orchestrator/apps/platform-web/server.js" \
    "apps/platform-web/.next/standalone/server.js"
  do
    if [ -f "$candidate" ]; then
      PLATFORM_SERVER="$candidate"
      break
    fi
  done
  if [ -n "$PLATFORM_SERVER" ]; then
    # Static assets must sit next to the standalone server entry.
    PLATFORM_SERVER_DIR=$(dirname "$PLATFORM_SERVER")
    if [ -d apps/platform-web/.next/static ] && [ ! -d "${PLATFORM_SERVER_DIR}/.next/static" ]; then
      mkdir -p "${PLATFORM_SERVER_DIR}/.next"
      cp -r apps/platform-web/.next/static "${PLATFORM_SERVER_DIR}/.next/static"
    fi
    PORT="${PLATFORM_WEB_PORT}" HOSTNAME=0.0.0.0 node "$PLATFORM_SERVER" &
  else
    echo "[entrypoint] WARN: platform-web standalone missing — skip :${PLATFORM_WEB_PORT}" >&2
  fi
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
