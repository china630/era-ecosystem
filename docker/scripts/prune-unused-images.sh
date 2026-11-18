#!/usr/bin/env bash
# Drop GHCR/satellite image tags not used by any running container.
# Safe after deploy: active containers keep their current image.
# Run on the droplet (or call from deploy-droplet.sh).
set -euo pipefail

echo "==> disk before image prune"
df -h / | tail -1
docker system df || true

echo "==> docker image prune -af (unused tags only)"
docker image prune -af

# Build cache can grow on builder hosts; no-op when empty.
docker builder prune -af >/dev/null 2>&1 || true

echo "==> disk after image prune"
df -h / | tail -1
docker system df || true
