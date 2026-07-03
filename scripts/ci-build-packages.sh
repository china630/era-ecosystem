#!/usr/bin/env bash
# Build shared workspace packages in dependency order (CI + local).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

build_pkg() {
  local dir="$1"
  echo "==> build ${dir}"
  (cd "packages/${dir}" && npm ci && npm run build)
}

build_pkg era-contracts
build_pkg clinic-domain
build_pkg i18n-common
build_pkg era-storage
build_pkg era-fiscal
build_pkg satellite-kit

echo "==> ci-build-packages: done"
