#!/usr/bin/env bash
# Remote droplet deploy — run AFTER git reset and after .env is in place.
# Keep `|` pipes in this file. appleboy/ssh-action (drone-ssh) drops inline
# script lines that contain `|`.
#
# DEPLOY_SCOPE (default all):
#   all | finance | orchestrator | data-hub | hotel | clinic | fnb | retail |
#   logistics | construction | crm | auto | wholesale | bank | custom
# DEPLOY_SERVICES: optional space-separated compose service names. When set,
#   this list wins over DEPLOY_SCOPE mapping (path-filtered auto-deploy).
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

scope="${DEPLOY_SCOPE:-all}"
services=""
if [ -n "${DEPLOY_SERVICES:-}" ]; then
  services="$DEPLOY_SERVICES"
  scope="${DEPLOY_SCOPE:-custom}"
else
  case "$scope" in
    all) services="" ;;
    finance) services="orchestrator finance-core finance-web" ;;
    finance-core) services="finance-core" ;;
    finance-web) services="finance-web" ;;
    orchestrator) services="orchestrator" ;;
    data-hub) services="data-hub" ;;
    hotel) services="hotel-pms" ;;
    clinic) services="clinic" ;;
    fnb) services="fnb-pos" ;;
    retail) services="retail-pos" ;;
    logistics) services="logistics" ;;
    construction) services="construction" ;;
    crm) services="crm" ;;
    auto) services="auto-service" ;;
    wholesale) services="wholesale" ;;
    bank) services="bank-core bank bank-dbo" ;;
    *)
      echo "Unknown DEPLOY_SCOPE=$scope" >&2
      exit 1
      ;;
  esac
fi

echo "Deploy scope=$scope services=${services:-ALL}"
echo "GHCR login as ${GH_ACTOR} (token length ${#GHCR_PULL_TOKEN})"
echo "$GHCR_PULL_TOKEN" | docker login ghcr.io -u "$GH_ACTOR" --password-stdin

echo "==> disk before pull"
df -h /
if [ -z "$services" ]; then
  # Full stack: drop unused tags so pull can extract layers.
  docker image prune -af || true
  docker builder prune -af || true
fi

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env)

if [ -z "$services" ]; then
  "${COMPOSE[@]}" pull
else
  # shellcheck disable=SC2086
  "${COMPOSE[@]}" pull $services
fi

chmod +x docker/scripts/migrate-all.sh
export DEPLOY_SERVICES="$services"
COMPOSE_FILE=docker-compose.prod.yml ./docker/scripts/migrate-all.sh

if [ -z "$services" ]; then
  "${COMPOSE[@]}" up -d --remove-orphans
  "${COMPOSE[@]}" up -d --wait --wait-timeout 180 orchestrator
  docker image prune -af || true
  node scripts/ecosystem-smoke-all.mjs || echo "WARN: ecosystem-smoke-all failed (non-blocking)"
else
  # Do not --remove-orphans or prune — that would stop/delete other satellites.
  # --no-deps: scoped IMAGE_TAG only exists for the rebuilt service; pulling
  # depends_on siblings (e.g. finance-web → finance-core) 404s on GHCR.
  # shellcheck disable=SC2086
  "${COMPOSE[@]}" up -d --wait --wait-timeout 180 --no-deps $services
fi
