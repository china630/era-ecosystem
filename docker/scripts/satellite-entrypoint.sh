#!/bin/sh
# Shared GHCR satellite entrypoint (docker/Dockerfile.satellite).
# Do not call `npx prisma` here — the runner image has no Prisma CLI and npx
# would try to download it, hanging Nightly smoke / droplet boot.
set -e
cd /app

if [ "${SKIP_PRISMA_MIGRATE:-0}" != "1" ] && [ -f prisma/schema.prisma ]; then
  if command -v psql >/dev/null 2>&1 && [ -f ./scripts/docker-migrate-deploy.mjs ]; then
    if ! node ./scripts/docker-migrate-deploy.mjs; then
      echo "[entrypoint] WARN: docker-migrate-deploy failed" >&2
    fi
  fi
  if [ "$RUN_SEED" = "true" ]; then
    npm run db:seed 2>/dev/null || npm run db:seed:vnext 2>/dev/null || true
  fi
fi

exec "$@"
