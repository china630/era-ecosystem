#!/usr/bin/env bash
# @erafinance/database is linked via file: from era-data-hub; npm runs its postinstall
# before local node_modules exist unless this package is installed first.
# Prisma 7 prisma.config.ts requires DATABASE_URL in CI (no era-finance-core/.env).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_DIR="${ROOT}/era-finance-core/packages/database"
export DATABASE_URL="${DATABASE_URL:-postgresql://build:build@127.0.0.1:5432/build?schema=public}"

echo "==> prepare @erafinance/database"
(
  cd "$DB_DIR"
  npm install --ignore-scripts
  npx prisma generate
  npm run build:chart
)

echo "==> ci-prepare-finance-database: done"
