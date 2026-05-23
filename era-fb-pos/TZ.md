# TZ — ERA F&B POS (domain-local)

> Technical specification — local to this submodule. Architecture index: [`doc/README.md`](./doc/README.md).

## Stack

- Next.js 15 (App Router), port **3200**
- Prisma 6 + PostgreSQL (`era_fb_pos` database)
- PMS bridge client → `era-hotel-pms` (`PMS_BRIDGE_URL`, `POS_BRIDGE_SECRET`)

## Integration contract

- OpenAPI: [`doc/openapi/fb-pos-pms-bridge.yaml`](./doc/openapi/fb-pos-pms-bridge.yaml)
- Webhook consumer: `POST /api/webhooks/pms/reservation-lifecycle`

## UI

Follow umbrella [`DESIGN.md`](../DESIGN.md) — tokens in `src/lib/design-system.ts`.
