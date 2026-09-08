#!/usr/bin/env bash
# Person name canon — droplet ops order (run on /opt/era-ecosystem after image pull).
# 1) MDM migrate + backfill name parts
# 2) Finance patronymic → MDM backfill (while column exists)
# 3) Finance / hotel / clinic migrate deploy
set -euo pipefail
cd /opt/era-ecosystem

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env)

echo "==> MDM migrate (name part columns)"
"${COMPOSE[@]}" run --rm --no-deps orchestrator sh -lc \
  'cd /app/packages/mdm-database && npx prisma migrate deploy'

echo "==> MDM backfill fullNameCipher → parts (needs PII_ENCRYPTION_KEY in .env)"
if [ -z "${PII_ENCRYPTION_KEY:-}" ]; then
  echo "WARN: PII_ENCRYPTION_KEY unset — skip MDM backfill"
else
  "${COMPOSE[@]}" run --rm --no-deps orchestrator sh -lc \
    'cd /app && npx tsx packages/mdm-database/prisma/scripts/backfill-person-name-parts.ts' \
    || echo "WARN: MDM backfill failed or already done"
fi

echo "==> Finance patronymic → MDM (before DROP patronymic migration)"
"${COMPOSE[@]}" run --rm --no-deps finance-core sh -lc \
  'node scripts/backfill-employee-patronymic-to-mdm.mjs' \
  || echo "WARN: finance patronymic backfill skipped (no column or no rows)"

echo "==> Remaining migrations (finance DROP patronymic, hotel, clinic, …)"
chmod +x docker/scripts/migrate-all.sh
COMPOSE_FILE=docker-compose.prod.yml ./docker/scripts/migrate-all.sh

echo "==> person-name-canon-droplet: done"
