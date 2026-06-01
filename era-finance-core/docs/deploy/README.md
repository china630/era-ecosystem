# Deploy Documentation Center (Finance ERP)

**Ecosystem deploy (Orch + satellites + Finance):** start at [docs/SETUP_AND_RUN.md](../../../docs/SETUP_AND_RUN.md) and [FINANCE-ERP-DEPLOY.md](./FINANCE-ERP-DEPLOY.md).

This directory covers **Finance-only** production: Postgres, Redis, `apps/api`, `apps/web`.

## Docker orchestration (compose)

| Compose file | When to use |
|--------------|-------------|
| [`docker-compose.yml`](../../docker-compose.yml) | Local dev: Postgres + Redis (`DOCKER_DATA_ROOT`). `npm run db:bootstrap-local`. |
| [`docker-compose.prod.yml`](../../docker-compose.prod.yml) | Production-like Finance stack only. Migrations via `npm run db:migrate:deploy`. |
| [`monitoring/docker-compose.monitoring.yml`](./monitoring/docker-compose.monitoring.yml) | Optional Prometheus + Grafana ([monitoring/README.md](./monitoring/README.md)). |

Build from **era-finance-core** root:

```bash
docker build -f apps/api/Dockerfile .
docker build -f apps/web/Dockerfile .
```

Squashed migration: `packages/database/prisma/migrations/20260520120000_squashed_schema`. Secrets: `env.production.example` → `.env`.

**Stack:** Node 22, Postgres 16, Redis 7, Prisma 7.

## Quick Scenario Map

| Scenario | Start Here |
|----------|------------|
| **Umbrella stack (recommended)** | [docs/SETUP_AND_RUN.md](../../../docs/SETUP_AND_RUN.md) |
| Finance-only production (RU) | `deploy.ru.md` → `PRE-RELEASE-CHECKLIST.md` |
| Finance-only production (EN) | `deploy.md` → `PRE-RELEASE-CHECKLIST.md` |
| Extension (Assistant / DVX) | `EXTENSION_MVP_DEPLOY.md` |
| DR drill / incident | `DR_RUNBOOK.md` |

## On-Call Reading Order

1. Confirm scope: umbrella incident vs Finance ERP-only.
2. Open matching runbook; do not skip verification checkpoints.
3. DB changes: `db:migrate:deploy` / `db:deploy` with backup per `DR_RUNBOOK.md`.

## Active Runbooks

- `deploy.ru.md` — primary production guide (Russian).
- `deploy.md` — production guide (English).
- `DR_RUNBOOK.md` — backup, restore, RPO/RTO.
- `PRE-RELEASE-CHECKLIST.md` — pre-tag checklist (guards, secrets, smoke).
- `EXTENSION_MVP_DEPLOY.md` — ERA Finance Assistant extension.

## Reverse proxy examples

- `../nginx-maintenance.conf` — maintenance toggle.
- `../nginx-erafinance-production.example.conf` — gzip, upstreams, TLS placeholders.

## HTML exports

Deploy guides are Markdown only. Regenerate HTML locally if needed; do not commit under `docs/deploy/`.
