# DELIVERY — ERA Data Hub

Source of truth for implementation checkboxes.

## Wave 0 — Foundation

- [x] `era-data-hub` NestJS + Prisma workspace
- [x] Docker service `data-hub:4200` on `era-network`
- [x] Traefik `data.era-365.online`
- [x] DB `era_data_hub` in init-databases.sql
- [x] Auth: API key (MVP) + service token
- [x] Swagger `/registry/v1/docs`
- [x] Health `/healthz`

## Wave 1 — FX (pilot)

- [x] `GET /registry/v1/fx/rates`
- [x] `GET /registry/v1/fx/rates/range`
- [x] `GET /registry/v1/fx/convert`
- [x] Full CBAR ingest in hub (`cbar-fx`, `cbar-rate-sync`, cron → `era_data_hub`)

## Wave 2 — Banks + IBAN

- [x] `GET /registry/v1/banks`
- [x] `GET /registry/v1/banks/branches/:code`
- [x] `GET /registry/v1/iban/validate`

## Wave 3 — VÖEN

- [x] `GET /registry/v1/companies/:voen`
- [x] PII masking flag for external keys

## Wave 4 — HS / tariffs

- [x] `GET /registry/v1/hs/:code`
- [x] `GET /registry/v1/hs/:code/tariff`

## Wave 5 — Static catalogs

- [x] Geo, UoM, tax rates, chart of accounts endpoints
- [x] Catalog JSON vendored under `packages/database/catalog`

## Wave 6 — Finance consumer

- [x] `DataHubClientService` + `ERA_DATA_HUB_ENABLED`
- [x] `getFinalOfficialAznPerUnit` read-through
- [x] `ERA_DATA_HUB_FINANCE_CBAR_INGEST_DISABLED` for cron skip
- [x] `getTariff`, `getCompany`, `isWorkingDay` on client
- [x] Customs tax calculator hub tariff resolve

## Wave 7 — Orchestrator product

- [x] `platform_reference_data` in pricing-module-seed
- [x] `POST /platform/reference-data/v1/validate-key` + audit meter stub
- [x] Hub `ApiKeyGuard` live mode → orchestrator

## Wave 8 — Documentation

- [x] PRD, TZ, README, DELIVERY, DOCUMENTATION-INDEX, UAT-SMOKE
- [x] Umbrella docs registration
- [x] Pass 2: `API-EXAMPLES.md`, `DATA-HUB-CONSUMER.md`

---

## Pass 2 — Technical + docs (2026-06)

### A1 — CBAR ingest

- [x] Port `cbar-fx.service.ts`, `cbar-rate-sync.service.ts`, cron
- [x] Writes only when `ERA_DATA_HUB_DATA_SOURCE=hub`

### A2 — Phase 1 cutover

- [x] `db:sync-from-finance` documented
- [x] Catalog copy into hub package
- [x] Docker `DATA_HUB_FINANCE_CATALOG_ROOT` / hub catalog path

### A3 — Redis cache (S8)

- [x] `RegistryCacheService` (Redis db4)
- [x] `ETag` + `Cache-Control` interceptor on GET `/registry/v1/*`

### A4 — Orchestrator API keys

- [x] `reference-data` module validate-key
- [x] `PLATFORM_REFERENCE_DATA_MODE=live` on hub

### A5 — Finance clients

- [x] Extended `DataHubClientService`
- [x] Customs calculator via hub tariffs

### A6 — Build / smoke

- [x] Prisma 7 config + Dockerfile monorepo build
- [x] `scripts/smoke-data-hub.mjs`

### B1–B4 — Documentation

- [x] Object docs (TZ contract, API examples, consumer guide)
- [x] Umbrella SETUP / LOCAL_FOLDER_DEV / README / READINESS / ADR
- [x] Orchestrator DELIVERY + UAT reference-data
- [x] `SMOKE_ALL_SERVICES` + UAT Pass 2 scenarios
