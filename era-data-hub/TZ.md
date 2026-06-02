# ERA Data Hub — TZ (API contract)

Base URL: `/registry/v1` on `data.era-365.online` (internal: `http://data-hub:4200`).

Swagger: `/registry/v1/docs` · Health: `/healthz` (no prefix)

## Auth

| Mode | Header | Notes |
|------|--------|-------|
| External | `X-Api-Key: <key>` | MVP: `DATA_HUB_DEV_API_KEYS`; live: orchestrator `validate-key` |
| Internal | `Authorization: Bearer <DATA_HUB_SERVICE_TOKEN>` | ERA services on `era-network` |

Missing/invalid auth → `401` `{ "code": "UNAUTHORIZED", "message": "..." }`

## Error envelope

All registry errors use:

```json
{ "code": "ERROR_CODE", "message": "Human-readable detail" }
```

Common codes: `INVALID_DATE`, `INVALID_PROFILE`, `HS_NOT_FOUND`, `TARIFF_NOT_FOUND`, `COMPANY_NOT_FOUND`, `INVALID_API_KEY`.

## Cache headers (Pass 2)

GET responses include `ETag`, `Cache-Control: public, max-age=…` (Redis-backed when `REDIS_URL` set).

| Endpoint family | max-age (typical) |
|-----------------|-------------------|
| `/fx/rates` (spot) | 300s |
| `/fx/rates/range` | 86400s |
| `/calendar/*` | 86400s |
| Other GET | 3600s |

`If-None-Match` → `304` when body unchanged.

## Endpoints

### FX

| Method | Path | Query | Response |
|--------|------|-------|----------|
| GET | `/fx/rates` | `date?` (ISO date), `symbols` (comma ISO) | `{ meta, rates: [{ currencyCode, rate, rateDate, status? }] }` |
| GET | `/fx/rates/range` | `from`, `to`, `symbol` | `{ meta, symbol, points: [{ date, rate }] }` |
| GET | `/fx/convert` | `from`, `to`, `amount`, `date?` | `{ meta, from, to, amount, result, rateDate }` |

### Calendar

| Method | Path | Query |
|--------|------|-------|
| GET | `/calendar/:country/is-working-day` | `date` |
| GET | `/calendar/:country/add-business-days` | `date`, `n` |

`:country` — `az` (MVP seeded).

### HS / customs

| Method | Path | Query |
|--------|------|-------|
| GET | `/hs/:code` | — |
| GET | `/hs/:code/tariff` | `date?` |

### Companies

| Method | Path | Query |
|--------|------|-------|
| GET | `/companies/:voen` | `maskPii` (`true` default for API keys) |

### Banks / IBAN

| Method | Path | Query |
|--------|------|-------|
| GET | `/banks` | — |
| GET | `/banks/branches/:code` | — |
| GET | `/iban/validate` | `iban` |

### Static catalogs

| Method | Path | Query |
|--------|------|-------|
| GET | `/geo/countries` | — |
| GET | `/geo/cities` | `country` |
| GET | `/uom` | — |
| GET | `/tax-rates` | `type`, `date?` |
| GET | `/chart-of-accounts` | `profile` = `commercial` \| `budget` \| `ngo` |

## Data sources

| `ERA_DATA_HUB_DATA_SOURCE` | Reads | Ingest |
|----------------------------|-------|--------|
| `finance_ro` (default) | `era_finance` via `FINANCE_RO_DATABASE_URL` | CBAR cron no-op |
| `hub` | `era_data_hub` (`DATABASE_URL`) | CBAR cron → `cbar_official_rates` |

Phase 1 cutover: `npm run db:sync-from-finance` then `ERA_DATA_HUB_DATA_SOURCE=hub`.

Catalog JSON: `packages/database/catalog/{national,trade}` (or `DATA_HUB_FINANCE_CATALOG_ROOT`).

## Prisma

Package: `@era/data-hub-database` — `packages/database/prisma/schema.prisma`.

## Orchestrator product

Module key: `platform_reference_data` · validate: `POST /platform/reference-data/v1/validate-key` (service token).
