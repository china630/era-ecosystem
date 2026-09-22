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
    # Default false on droplet (CLINIC_*/BANK_*/HOTEL_*_RUN_SEED).
    # db:seed = satellite/reference only (never db:seed:demo / wipe / demo-org).
    # ADR: docs/adr/satellite-seed-hygiene.md · clinic-catalog-template-overlay.md
    echo "[entrypoint] RUN_SEED=true → npm run db:seed"
    npm run db:seed || echo "[entrypoint] WARN: db:seed failed" >&2
  fi
fi

exec "$@"
