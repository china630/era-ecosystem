# era-fnb-pos

ERA **Food & Beverage POS** satellite — floor, orders, KDS, reservations, fiscal.  
**Not** in scope: PMS folio, night audit, medical contour (see `era-hotel-pms`).

| Doc | Path |
|-----|------|
| Product spec | [`doc/`](./doc/) |
| PRD / TZ | [`PRD.md`](./PRD.md), [`TZ.md`](./TZ.md) |
| Global UI | [`../DESIGN.md`](../DESIGN.md) |
| PMS bridge OpenAPI | [`doc/openapi/fb-pos-pms-bridge.yaml`](./doc/openapi/fb-pos-pms-bridge.yaml) |

## Dev

```bash
cp .env.example .env
npm install
npx prisma db push
npm run db:seed              # no-op (org-scoped)
# Lab waiter/outlet: ERA_SATELLITE_ORGANIZATION_ID=<uuid> npm run db:seed:demo
npm run dev   # http://localhost:3202
```

Point `PMS_BRIDGE_URL` at running `era-hotel-pms` and match `POS_BRIDGE_SECRET`.
