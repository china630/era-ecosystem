#!/usr/bin/env bash
# Remote droplet deploy — run AFTER git reset and after .env is in place.
# Keep `|` pipes in this file. appleboy/ssh-action (drone-ssh) drops inline
# script lines that contain `|`.
set -euo pipefail
cd /opt/era-ecosystem

if [ ! -f .env ]; then
  echo ".env is missing — scp era.droplet.env before this script" >&2
  exit 1
fi
if [ -z "${GHCR_PULL_TOKEN:-}" ]; then
  echo "GHCR_PULL_TOKEN is empty — cannot docker login to ghcr.io" >&2
  exit 1
fi
if [ -z "${GH_ACTOR:-}" ]; then
  echo "GH_ACTOR is empty — docker login needs a GitHub username" >&2
  exit 1
fi

echo "GHCR login as ${GH_ACTOR} (token length ${#GHCR_PULL_TOKEN})"
echo "$GHCR_PULL_TOKEN" | docker login ghcr.io -u "$GH_ACTOR" --password-stdin

docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env pull
chmod +x docker/scripts/migrate-all.sh
COMPOSE_FILE=docker-compose.prod.yml ./docker/scripts/migrate-all.sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env up -d --remove-orphans
docker image prune -af || true
node scripts/ecosystem-smoke-all.mjs || echo "WARN: ecosystem-smoke-all failed (non-blocking)"
