# ERA Retail POS — Technical specification (TZ)

Product requirements: [PRD.md](./PRD.md). Delivery tracker: [doc/DELIVERY-RETAIL.md](./doc/DELIVERY-RETAIL.md).

## Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node 20+, Next.js 15 App Router |
| DB | PostgreSQL `era_retail_pos` |
| ORM | Prisma 6 |
| Auth | `@era/satellite-kit` (JWT cookie + SSO HMAC) |
| Events | `@era/contracts`, `@era/satellite-kit` gateway |
| UI | Tailwind + `@era/satellite-kit/ui` |

## Deployment

| Param | Value |
|-------|-------|
| Port | 3300 |
| Host | `retail.era.az` |
| Docker | [Dockerfile](./Dockerfile), umbrella [docker-compose.yml](../docker-compose.yml) service `retail-pos` |

## Data model (R1 target)

```text
Tenant → Outlet (preset) → Register → Shift → Receipt → ReceiptLine
```

Preset enum: `grocery | apparel | electronics | pharmacy` — [src/lib/retail-preset.ts](./src/lib/retail-preset.ts).

## API surface (planned)

| Method | Path | PRD |
|--------|------|-----|
| POST | `/api/auth/sso/exchange` | R-14 |
| POST | `/api/auth/login` | local dev |
| GET | `/api/health` | R0 |
| POST | `/api/events/dispatch` | R-05 |
| POST | `/api/shifts/open` | R-01 |
| POST | `/api/shifts/close` | R-04 |
| POST | `/api/receipts` | R-02 |
| POST | `/api/receipts/:id/pay` | R-03, R-05 |

## Environment

See [.env.example](./.env.example): `DATABASE_URL`, `AUTH_JWT_SECRET`, `ERA_SSO_SHARED_SECRET`, `ORCHESTRATOR_EVENT_URL`, `SATELLITE_EVENT_SERVICE_TOKEN`, `ERA_SATELLITE_ORGANIZATION_ID`.

## Testing

- Build: `npm run build`
- Smoke: [doc/UAT-SMOKE.md](./doc/UAT-SMOKE.md)
- Umbrella: [docs/SMOKE_ALL_SERVICES.md](../docs/SMOKE_ALL_SERVICES.md)
