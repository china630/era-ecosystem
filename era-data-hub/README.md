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
4. Runtime reads `era_data_hub`. Turn FX external fetch on at orchestrator `/super-admin/reference`.
5. Point consumers at `ERA_DATA_HUB_URL` and the same `DATA_HUB_SERVICE_TOKEN`.
6. Run UAT: [doc/UAT-SMOKE.md](./doc/UAT-SMOKE.md).
