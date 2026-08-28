#!/usr/bin/env bash
# Apply Prisma migrations for all ERA stack databases.
# Always `compose run --no-deps` (fresh pulled image), never exec into a stale container.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE_BASE="${COMPOSE_BASE:-docker-compose.yml}"
ENV_FILE="${ENV_FILE:-.env}"
if [[ "$COMPOSE_FILE" == "docker-compose.prod.yml" ]]; then
  COMPOSE_ARGS=(-f "$COMPOSE_BASE" -f "$COMPOSE_FILE")
else
  COMPOSE_ARGS=(-f "$COMPOSE_FILE")
fi
if [[ -f "$ENV_FILE" ]]; then
  COMPOSE=(docker compose "${COMPOSE_ARGS[@]}" --env-file "$ENV_FILE")
else
  COMPOSE=(docker compose "${COMPOSE_ARGS[@]}")
fi

should_migrate() {
  local svc="$1"
  if [ -z "${DEPLOY_SERVICES:-}" ]; then
    return 0
  fi
  local s
  for s in $DEPLOY_SERVICES; do
    if [ "$s" = "$svc" ]; then
      return 0
    fi
  done
  return 1
}

satellite_dir() {
  case "$1" in
    hotel-pms) echo era-hotel-pms ;;
    fnb-pos) echo era-fnb-pos ;;
    clinic) echo era-clinic ;;
    retail-pos) echo era-retail-pos ;;
    logistics) echo era-logistics ;;
    construction) echo era-construction ;;
    crm) echo era-crm ;;
    auto-service) echo era-auto-service ;;
    wholesale) echo era-wholesale ;;
    bank) echo era-bank ;;
    bank-dbo) echo era-bank-dbo ;;
    *) echo "" ;;
  esac
}

# Host-side current-schema SQL so Nightly/droplet can baseline empty DBs
# even before GHCR images contain prisma/baseline.sql.
ensure_host_baseline() {
  local svc="$1"
  local dir schema out
  dir="$(satellite_dir "$svc")"
  schema="$ROOT/$dir/prisma/schema.prisma"
  out="/tmp/era-baseline-${svc}.sql"
  if [ -z "$dir" ] || [ ! -f "$schema" ]; then
    return 1
  fi
  if [ -f "$out" ] && grep -q CREATE "$out"; then
    echo "$out"
    return 0
  fi
  if ! command -v npx >/dev/null 2>&1; then
    return 1
  fi
  echo "    host baseline: $dir" >&2
  DATABASE_URL="postgresql://prisma:prisma@127.0.0.1:5432/prisma" \
    npx --yes prisma@6.9.0 migrate diff \
      --from-empty \
      --to-schema-datamodel "$schema" \
      --script > "$out"
  grep -q CREATE "$out" || return 1
  echo "$out"
}

run_migrate() {
  local service="$1"
  local cmd="$2"
  shift 2
  local extra=("$@")
  if ! should_migrate "$service"; then
    return 0
  fi
  echo "==> migrate: $service"
  "${COMPOSE[@]}" run --rm --no-deps --entrypoint sh "${extra[@]}" "$service" -lc "$cmd"
}

run_satellite_migrate() {
  local svc="$1"
  local extra=()
  local js="$ROOT/docker/scripts/docker-migrate-deploy.mjs"
  local base
  if [ -f "$js" ]; then
    extra+=(-v "$js:/app/scripts/docker-migrate-deploy.mjs:ro")
  fi
  if base="$(ensure_host_baseline "$svc")"; then
    extra+=(-v "$base:/app/prisma/baseline.sql:ro")
  fi
  run_migrate "$svc" "node scripts/docker-migrate-deploy.mjs" "${extra[@]}"
}

echo "==> migrate-all: ensure postgres"
"${COMPOSE[@]}" up -d postgres
PGUSER="${POSTGRES_USER:-era}"
ready=0
for _ in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U "$PGUSER" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
if [ "$ready" != "1" ]; then
  echo "ERROR: postgres did not become ready"
  exit 1
fi

failed=0
run_or_flag() {
  if ! run_migrate "$1" "$2"; then
    echo "ERROR: migrate failed for $1"
    failed=1
  fi
}

run_or_flag orchestrator "cd /app/packages/database && npx prisma migrate deploy"
run_migrate orchestrator "cd /app/packages/mdm-database && npx prisma migrate deploy" || echo "WARN: mdm migrate skipped or failed"
run_or_flag finance-core "cd /app/packages/database && npx prisma migrate deploy"
run_migrate data-hub "cd /app/packages/database && npx prisma migrate deploy" || echo "WARN: data-hub migrate skipped or failed"

for svc in hotel-pms fnb-pos clinic retail-pos logistics construction crm auto-service wholesale; do
  if should_migrate "$svc"; then
    if ! run_satellite_migrate "$svc"; then
      echo "ERROR: migrate failed for $svc"
      failed=1
    fi
  fi
done

run_or_flag bank-core "cd /app/packages/database && npx prisma migrate deploy"
for svc in bank bank-dbo; do
  if should_migrate "$svc"; then
    if ! run_satellite_migrate "$svc"; then
      echo "ERROR: migrate failed for $svc"
      failed=1
    fi
  fi
done

if [ "$failed" != "0" ]; then
  echo "==> migrate-all: FAILED"
  exit 1
fi
echo "==> migrate-all: done"
