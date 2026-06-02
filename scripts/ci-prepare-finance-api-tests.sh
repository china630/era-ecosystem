#!/usr/bin/env bash
# Finance API Jest: workspace packages + control-plane Prisma runtime on the runner.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> build @erafinance/api-contracts"
(cd "$ROOT/era-finance-core" && npm run build -w @erafinance/api-contracts)

echo "==> install @prisma/* for committed @era365/database generated client"
(
  cd "$ROOT/era-orchestrator/packages/database"
  npm install --ignore-scripts --no-save \
    "@prisma/client@^7.0.0" \
    "@prisma/client-runtime-utils@^7.0.0"
)

echo "==> ci-prepare-finance-api-tests: done"
