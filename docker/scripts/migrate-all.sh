#!/usr/bin/env bash
# Apply Prisma migrations for all ERA stack databases (compose must be up or images pulled).
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

run_migrate() {
  local service="$1"
  local cmd="$2"
  echo "==> migrate: $service"
  if "${COMPOSE[@]}" ps -q "$service" 2>/dev/null | grep -q .; then
    "${COMPOSE[@]}" exec -T "$service" sh -lc "$cmd"
  else
    "${COMPOSE[@]}" run --rm "$service" sh -lc "$cmd"
  fi
}

# Platform
run_migrate orchestrator "cd /app/packages/database && npx prisma migrate deploy"
run_migrate orchestrator "cd /app/packages/mdm-database && npx prisma migrate deploy" || true
run_migrate finance-core "cd /app/packages/database && npx prisma migrate deploy"
run_migrate data-hub "cd /app/packages/database && npx prisma migrate deploy" || true

# Industry satellites (entrypoint script in image)
for svc in hotel-pms fnb-pos clinic retail-pos logistics construction crm auto-service wholesale; do
  run_migrate "$svc" "node scripts/docker-migrate-deploy.mjs" || echo "WARN: migrate skipped or failed for $svc"
done

# Bank CBS stack
run_migrate bank-core "cd /app/packages/database && npx prisma migrate deploy" || echo "WARN: bank-core migrate failed"
for svc in bank bank-dbo; do
  run_migrate "$svc" "node scripts/docker-migrate-deploy.mjs" || echo "WARN: migrate skipped or failed for $svc"
done

echo "==> migrate-all: done"
