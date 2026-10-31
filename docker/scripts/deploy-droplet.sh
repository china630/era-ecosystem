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
#
# Safety (2026-10-31):
# - Never `docker rm -f` compose-managed containers just to "clear names" —
#   that wiped a live stack when finance then failed health (outage class).
# - Only remove true orphans (wrong/missing compose project label).
# - Full deploy: wait finance-core healthy before the rest; dump logs on fail;
#   critical HTTP smoke is blocking (not WARN-only).
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

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env)
EXPECTED_PROJECT="${COMPOSE_PROJECT_NAME:-}"
if [ -z "$EXPECTED_PROJECT" ]; then
  EXPECTED_PROJECT="$(basename "$(pwd)")"
fi

# Map compose service -> fixed container_name (docker-compose.yml). No pipes:
# appleboy/ssh-action drops script lines that contain `|`.
container_name_for() {
  case "$1" in
    orchestrator) echo era-orchestrator ;;
    finance-core) echo era-finance-core ;;
    finance-web) echo era-finance-web ;;
    data-hub) echo era-data-hub ;;
    hotel-pms) echo era-hotel-pms ;;
    clinic) echo era-clinic ;;
    fnb-pos) echo era-fnb-pos ;;
    retail-pos) echo era-retail-pos ;;
    logistics) echo era-logistics ;;
    construction) echo era-construction ;;
    crm) echo era-crm ;;
    auto-service) echo era-auto-service ;;
    wholesale) echo era-wholesale ;;
    bank-core) echo era-bank-core ;;
    bank) echo era-bank ;;
    bank-dbo) echo era-bank-dbo ;;
    *) echo "" ;;
  esac
}

# Remove ONLY leftovers that hold a fixed name but are NOT this compose project.
# Compose-managed containers are left alone — `compose up` recreates them safely.
clear_orphan_name_conflicts() {
  local svc cname proj
  local -a targets
  if [ "$#" -eq 0 ]; then
    targets=(orchestrator finance-core finance-web data-hub hotel-pms clinic
      fnb-pos retail-pos logistics construction crm auto-service wholesale
      bank-core bank bank-dbo)
  else
    targets=("$@")
  fi
  for svc in "${targets[@]}"; do
    cname="$(container_name_for "$svc")"
    if [ -z "$cname" ]; then
      continue
    fi
    if ! docker inspect "$cname" >/dev/null 2>&1; then
      continue
    fi
    proj="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$cname" 2>/dev/null || true)"
    if [ "$proj" = "$EXPECTED_PROJECT" ]; then
      echo "==> keep compose-managed $cname (project=$proj)"
      continue
    fi
    echo "==> clearing orphan name conflict: $cname (project='${proj:-none}', expected=$EXPECTED_PROJECT)"
    docker rm -f "$cname" || true
  done
}

dump_critical_logs() {
  local c
  echo "==> dump critical container logs (tail 150)"
  for c in era-finance-core era-orchestrator era-data-hub era-finance-web; do
    echo "---- docker logs $c ----"
    docker logs --tail 150 "$c" 2>&1 || echo "(no logs for $c)"
  done
  echo "---- docker ps -a (critical) ----"
  docker ps -a --filter name=era-finance --filter name=era-orchestrator --filter name=era-data-hub --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' 2>&1 || true
}

if [ -z "$services" ]; then
  "${COMPOSE[@]}" pull
else
  # shellcheck disable=SC2086
  "${COMPOSE[@]}" pull $services
fi

chmod +x docker/scripts/migrate-all.sh docker/scripts/person-name-canon-droplet.sh 2>/dev/null || true
export DEPLOY_SERVICES="$services"
if [ -z "$services" ] && [ -f docker/scripts/person-name-canon-droplet.sh ]; then
  echo "==> full deploy: person-name-canon (MDM backfill, finance patronymic, migrate-all)"
  ./docker/scripts/person-name-canon-droplet.sh
else
  COMPOSE_FILE=docker-compose.prod.yml ./docker/scripts/migrate-all.sh
fi

if [ -z "$services" ]; then
  clear_orphan_name_conflicts
  echo "==> phase1: postgres redis"
  "${COMPOSE[@]}" up -d postgres redis
  "${COMPOSE[@]}" up -d --wait --wait-timeout 120 postgres redis
  echo "==> phase2: finance-core (must be healthy before dependents)"
  "${COMPOSE[@]}" up -d finance-core
  if ! "${COMPOSE[@]}" up -d --wait --wait-timeout 300 finance-core; then
    echo "ERROR: finance-core failed to become healthy" >&2
    dump_critical_logs
    exit 1
  fi
  echo "==> phase3: full stack recreate (compose-managed; no wipe)"
  "${COMPOSE[@]}" up -d --remove-orphans
  if ! "${COMPOSE[@]}" up -d --wait --wait-timeout 180 orchestrator; then
    echo "ERROR: orchestrator wait failed" >&2
    dump_critical_logs
    exit 1
  fi
  if ! "${COMPOSE[@]}" up -d --wait --wait-timeout 180 data-hub finance-web; then
    echo "ERROR: data-hub / finance-web wait failed" >&2
    dump_critical_logs
    exit 1
  fi
  echo "==> critical smoke (blocking)"
  if ! node scripts/ecosystem-smoke-critical.mjs; then
    echo "ERROR: critical smoke failed — deploy not green" >&2
    dump_critical_logs
    exit 1
  fi
  docker image prune -f || true
  node scripts/ecosystem-smoke-all.mjs || echo "WARN: full ecosystem-smoke-all failed (non-blocking; critical already passed)"
else
  # Do not --remove-orphans or prune — that would stop/delete other satellites.
  # --no-deps: scoped IMAGE_TAG only exists for the rebuilt service; pulling
  # depends_on siblings (e.g. finance-web → finance-core) 404s on GHCR.
  # shellcheck disable=SC2086
  clear_orphan_name_conflicts $services
  # shellcheck disable=SC2086
  if ! "${COMPOSE[@]}" up -d --wait --wait-timeout 180 --no-deps $services; then
    dump_critical_logs
    exit 1
  fi
fi
