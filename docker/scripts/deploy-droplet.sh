#!/usr/bin/env bash
# Remote droplet deploy — run AFTER `git reset --hard` from GitHub Actions SSH.
# Keep `|` pipes in this file. appleboy/ssh-action (drone-ssh) drops script lines
# that contain `|`, which skipped `docker login` and left GHCR pulls anonymous.
set -euo pipefail
cd /opt/era-ecosystem

if [ -z "${ERA_ENV_B64:-}" ]; then
  echo "ERA_ENV_B64 is empty — cannot write .env" >&2
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

printf '%s' "$ERA_ENV_B64" | base64 -d > .env
echo "$GHCR_PULL_TOKEN" | docker login ghcr.io -u "$GH_ACTOR" --password-stdin

docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env pull
chmod +x docker/scripts/migrate-all.sh
COMPOSE_FILE=docker-compose.prod.yml ./docker/scripts/migrate-all.sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env up -d --remove-orphans
docker image prune -af || true
node scripts/ecosystem-smoke-all.mjs || echo "WARN: ecosystem-smoke-all failed (non-blocking)"
