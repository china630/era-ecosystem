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

Customs: `CustomsTaxCalculatorService` resolves tariffs from hub when enabled. `CustomsService` auto-fills `currencyRate` from hub CBAR on `bgdDate` when invoice currency ≠ AZN.

## FX API (`/registry/v1/fx/*`)

| Endpoint | Mode | Notes |
|----------|------|-------|
| `GET /fx/rates?date=&symbols=` | Strict | FINAL rates for accounting; Baku `YYYY-MM-DD` |
| `GET /fx/rates/range?from=&to=&symbol=` | Strict | Historical series |
| `GET /fx/convert?from=&to=&amount=&date=` | Operational | PRELIMINARY ok before ~10:00 Baku |

**Consumers:** `era-finance-core` (converter, revaluation, customs), `era-bank-core` (EOD/treasury dated FINAL). Industry satellites use **Orchestrator Platform Gateway** `GET /platform/v1/catalog/fx/convert` via `@era/satellite-kit` — not hub or Finance direct.

See [docs/adr/fx-rates-ecosystem.md](../../docs/adr/fx-rates-ecosystem.md).

## Calendar API (`/registry/v1/calendar/*`)

| Endpoint | Mode | Notes |
|----------|------|-------|
| `GET /calendar/:country/day?date=` | Both | `{ isWorking, dayType, label* }` |
| `GET /calendar/:country/days?from=&to=` | Demand batch | Hotel auto-BAR warm cache |
| `GET /calendar/:country/is-working-day?date=` | Labor | Alias of `/day` |
| `GET /calendar/:country/add-business-days?date=&n=` | Labor | Settlement / SLA |

**Consumers:** finance HR (`HrCalendarService`), bank EOD (`DataHubClient.isWorkingDay`), industry satellites via orchestrator `GET /platform/v1/catalog/calendar/*` (hotel auto-BAR, clinic scheduling, logistics SLA).

Client: `packages/satellite-kit/src/integration/calendar.client.ts` → `platform-catalog.client.ts`.

See [docs/adr/production-calendar-ecosystem.md](../../docs/adr/production-calendar-ecosystem.md).

## Data source (hub service)

| `ERA_DATA_HUB_DATA_SOURCE` | Behaviour |
|----------------------------|-----------|
| `finance_ro` (default) | Registry reads `era_finance` via `FINANCE_RO_DATABASE_URL` (D1) |
| `hub` | Registry + CBAR ingest write `era_data_hub` |

Cutover: `npm run db:sync-from-finance` then set `ERA_DATA_HUB_DATA_SOURCE=hub`.

## Fallback

If hub HTTP fails or `ERA_DATA_HUB_ENABLED=false`, finance keeps local Prisma paths.

## Industry satellites (orchestrator gateway only)

**Rule:** `era-logistics`, `era-wholesale`, `era-hotel-pms`, etc. **must not** set `ERA_DATA_HUB_*` or call `/registry/v1` directly.

| Concern | Orchestrator gateway | satellite-kit |
|---------|----------------------|---------------|
| FX display convert | `GET /platform/v1/catalog/fx/convert` | `platformFxConvert` / `financeFxPreview` (alias) |
| Production calendar | `GET /platform/v1/catalog/calendar/:country/*` | `getCalendarDay`, `addCalendarBusinessDays`, … |
| VÖEN directory | `GET /platform/v1/catalog/companies/:voen` | `platformVoenLookup` / `financeVoenLookup` (alias) |
| HS tariff preview | Finance `GET /api/logistics/hs-preview` | `financeHsTariffPreview` (Finance-only, W2 out of scope) |
| Full customs / GTK | Finance UI `/customs` | deep link |

Auth: `Authorization: Bearer` = `SATELLITE_EVENT_SERVICE_TOKEN` + header `X-Organization-Id` = deployment org.

Client: `packages/satellite-kit/src/integration/platform-catalog.client.ts`.  
Direct hub client (finance/bank/orchestrator backend only): `reference-catalog.client.ts` / `DataHubProxyClient`.

See [docs/adr/orchestrator-platform-integration-gateway.md](../../docs/adr/orchestrator-platform-integration-gateway.md).

## Orchestrator (API keys)

Live mode: hub calls `POST {CONTROL_PLANE_URL}/platform/reference-data/v1/validate-key` with service token.

Configure orchestrator: `REFERENCE_DATA_VALID_API_KEYS=key:orgUuid` or `REFERENCE_DATA_DEFAULT_ORG_ID` for dev.
