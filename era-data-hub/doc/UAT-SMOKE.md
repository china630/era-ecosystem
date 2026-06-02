# UAT-SMOKE — ERA Data Hub

## Prerequisites

- `docker compose up -d data-hub finance-core postgres redis`
- Finance DB seeded (`cbar_official_rates`, banks, geo, etc.)
- Data hub: `npm run db:migrate` + `npm run db:seed` on `era_data_hub`

## Health

```http
GET http://127.0.0.1:4200/healthz
```

Expect `{"status":"ok","service":"era-data-hub"}`.

## Auth smoke

```http
GET http://127.0.0.1:4200/registry/v1/fx/rates?symbols=USD,EUR
X-Api-Key: dev-data-hub-key
```

Expect `rates` array with `meta.asOf`.

## Service token (internal)

```http
GET http://data-hub:4200/registry/v1/companies/1234567890
Authorization: Bearer dev-data-hub-service-token
```

(Use a real VÖEN from finance seeds if available.)

## Calendar (hub DB)

```http
GET http://127.0.0.1:4200/registry/v1/calendar/az/is-working-day?date=2026-01-01
X-Api-Key: dev-data-hub-key
```

Expect non-working day for 2026-01-01 (AZ holiday seed).

## Pass 2 — Data source modes

### finance_ro (default)

```bash
ERA_DATA_HUB_DATA_SOURCE=finance_ro docker compose up -d data-hub
node scripts/smoke-data-hub.mjs
```

Registry reads finance tables via RO URL; CBAR cron does not write hub DB.

### hub (SoR cutover)

```bash
cd era-data-hub && npm run db:sync-from-finance
ERA_DATA_HUB_DATA_SOURCE=hub docker compose up -d data-hub
```

After CBAR cron (or manual wait), verify:

```sql
SELECT COUNT(*) FROM cbar_official_rates;
```

in `era_data_hub`.

### CBAR ingest

With `ERA_DATA_HUB_DATA_SOURCE=hub` and `CBAR_EXTERNAL_FETCH_ENABLED=true`, check logs for `CBAR rates upserted`.

Finance side: `ERA_DATA_HUB_FINANCE_CBAR_INGEST_DISABLED=true` when hub owns ingest.

## Finance consumer

```bash
ERA_DATA_HUB_ENABLED=true
ERA_DATA_HUB_URL=http://data-hub:4200
DATA_HUB_SERVICE_TOKEN=dev-data-hub-service-token
```

- FX revaluation uses hub rates when available.
- Customs declaration line compute uses hub `GET /hs/:code/tariff` per line.

## Orchestrator API key (live)

```bash
PLATFORM_REFERENCE_DATA_MODE=live
REFERENCE_DATA_VALID_API_KEYS=dev-data-hub-key:<org-uuid>
REFERENCE_DATA_SKIP_ENTITLEMENT=1   # dev only if org lacks module
```

```http
POST http://127.0.0.1:4000/platform/reference-data/v1/validate-key
Authorization: Bearer dev-control-plane-token
Content-Type: application/json

{ "apiKey": "dev-data-hub-key" }
```

Expect `{ "valid": true, "organizationId": "...", "metered": true }`.

## Smoke script

```bash
node scripts/smoke-data-hub.mjs
```
