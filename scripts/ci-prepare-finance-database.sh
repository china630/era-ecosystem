#!/usr/bin/env bash
# @erafinance/database is linked via file: from era-data-hub; npm runs its postinstall
# before local node_modules exist unless this package is installed first.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_DIR="${ROOT}/era-finance-core/packages/database"

echo "==> prepare @erafinance/database"
(cd "$DB_DIR" && npm install && npm run build)

echo "==> ci-prepare-finance-database: done"
