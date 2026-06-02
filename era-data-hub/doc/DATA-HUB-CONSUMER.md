# ERA Data Hub — Consumer integration

## When to use

- **Internal ERA apps** (finance, satellites): `Authorization: Bearer <DATA_HUB_SERVICE_TOKEN>` — no per-tenant API key billing.
- **External B2B**: `X-Api-Key` validated via orchestrator `platform_reference_data` (`PLATFORM_REFERENCE_DATA_MODE=live`).

## URLs

| Environment | Base URL |
|-------------|----------|
| Docker `era-network` | `http://data-hub:4200/registry/v1` |
| Local | `http://127.0.0.1:4200/registry/v1` |
| Public (Traefik) | `https://data.era-365.online/registry/v1` |

Health (no auth): `GET /healthz`

## Finance (`era-finance-core`)

| Variable | Purpose |
|----------|---------|
| `ERA_DATA_HUB_ENABLED` | `true` — read FX / tariffs / calendar via hub |
| `ERA_DATA_HUB_URL` | Hub base (no path suffix) |
| `DATA_HUB_SERVICE_TOKEN` | Must match hub |
| `ERA_DATA_HUB_FINANCE_CBAR_INGEST_DISABLED` | `true` — finance cron skips CBAR; hub ingests when `ERA_DATA_HUB_DATA_SOURCE=hub` |

Client: `apps/api/src/data-hub/data-hub-client.service.ts` — `getFxRates`, `getTariff`, `getCompanyByVoen`, `isWorkingDay`.

Customs: `CustomsTaxCalculatorService` resolves tariffs from hub when enabled.

## Data source (hub service)

| `ERA_DATA_HUB_DATA_SOURCE` | Behaviour |
|----------------------------|-----------|
| `finance_ro` (default) | Registry reads `era_finance` via `FINANCE_RO_DATABASE_URL` (D1) |
| `hub` | Registry + CBAR ingest write `era_data_hub` |

Cutover: `npm run db:sync-from-finance` then set `ERA_DATA_HUB_DATA_SOURCE=hub`.

## Fallback

If hub HTTP fails or `ERA_DATA_HUB_ENABLED=false`, finance keeps local Prisma paths.

## Orchestrator (API keys)

Live mode: hub calls `POST {CONTROL_PLANE_URL}/platform/reference-data/v1/validate-key` with service token.

Configure orchestrator: `REFERENCE_DATA_VALID_API_KEYS=key:orgUuid` or `REFERENCE_DATA_DEFAULT_ORG_ID` for dev.
