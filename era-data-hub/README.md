# ERA Data Hub

Reference Data / DaaS service for the ERA ecosystem.

- **Public API:** `https://data.era-365.online/registry/v1/`
- **ADR:** [docs/adr/era-data-hub.md](../docs/adr/era-data-hub.md)
- **Delivery:** [doc/DELIVERY-DATA-HUB.md](./doc/DELIVERY-DATA-HUB.md)
- **Consumer guide:** [doc/DATA-HUB-CONSUMER.md](./doc/DATA-HUB-CONSUMER.md)
- **API examples:** [doc/API-EXAMPLES.md](./doc/API-EXAMPLES.md)

## Local run

```bash
cp .env.example .env
# Ensure era_finance has reference data (finance seeds) and era_data_hub exists
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Health: `GET http://127.0.0.1:4200/healthz`  
Swagger: `http://127.0.0.1:4200/registry/v1/docs`  
Auth: `X-Api-Key: dev-data-hub-key` or `Authorization: Bearer <DATA_HUB_SERVICE_TOKEN>`

Smoke: `node ../scripts/smoke-data-hub.mjs` (from repo root)

## Cutover playbook (Phase 0 → Phase 1)

1. Seed finance reference data (`era_finance`).
2. Create/migrate `era_data_hub`: `npm run db:migrate` + `npm run db:seed`.
3. Copy reference rows: `npm run db:sync-from-finance` (uses `FINANCE_RO_DATABASE_URL`).
4. Set `ERA_DATA_HUB_DATA_SOURCE=hub` on `data-hub` service.
5. Enable hub CBAR ingest; set `ERA_DATA_HUB_FINANCE_CBAR_INGEST_DISABLED=true` on finance.
6. Point consumers: `ERA_DATA_HUB_ENABLED=true`, `ERA_DATA_HUB_URL`, matching `DATA_HUB_SERVICE_TOKEN`.
7. Run UAT: [doc/UAT-SMOKE.md](./doc/UAT-SMOKE.md).
