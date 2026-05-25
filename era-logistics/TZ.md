# ERA Logistics — Technical specification (TZ)

Product requirements: [PRD.md](./PRD.md). Delivery tracker: [doc/DELIVERY-LOGISTICS.md](./doc/DELIVERY-LOGISTICS.md).

## Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node 20+, Next.js 15 App Router |
| DB | PostgreSQL `era_logistics` |
| ORM | Prisma 6 |
| Auth | `@era/satellite-kit` (JWT cookie + SSO HMAC) |
| Events | `@era/contracts`, `@era/satellite-kit` gateway |
| UI | Tailwind + `@era/satellite-kit/ui` |

## Deployment

| Param | Value |
|-------|-------|
| Port | 3301 |
| Host | `logistics.era.az` |
| Entitlement | `industry_logistics_customs` |
| Docker | umbrella [docker-compose.yml](../docker-compose.yml) service `logistics` |

## Data model (L1 target)

```text
Tenant → Vehicle → Driver → Trip → TripStop (optional) → PodRecord (L2)
```

## API surface (planned)

| Method | Path | PRD |
|--------|------|-----|
| POST | `/api/auth/sso/exchange` | platform |
| POST | `/api/auth/login` | local dev |
| GET | `/api/health` | L0 |
| POST | `/api/events/dispatch` | L-03 |
| GET/POST | `/api/vehicles` | L-02 |
| GET/POST | `/api/trips` | L-01 |
| GET/PATCH | `/api/trips/:id` | L2 status workflow |
| GET/POST | `/api/trips/:id/pod` | L-04 |
| GET/POST | `/api/trips/:id/fuel-report` | L-05 |
| GET | `/api/reports/fuel?from=&to=` | L-05 fleet rollup |
| POST | `/api/trips/:id/complete` | L-03 → `SATELLITE_LOGISTICS_TRIP_COMPLETED` |

## UI routes (L2)

| Path | Purpose |
|------|---------|
| `/trips` | Trip list → detail links |
| `/trips/[id]` | POD, fuel, status steps, complete |
| `/reports/fuel` | Date-range fuel summary table |

Event payload: `tripId`, `vehicleId`, `freightAmount`, `currency: AZN` — see [logistics.events.ts](../packages/era-contracts/src/events/logistics.events.ts).

## Environment

`DATABASE_URL`, `AUTH_JWT_SECRET`, `ERA_SSO_SHARED_SECRET`, `ORCHESTRATOR_EVENT_URL`, `SATELLITE_EVENT_SERVICE_TOKEN`, `ERA_SATELLITE_ORGANIZATION_ID` — [.env.example](./.env.example).

## Testing

- L1: close trip → orchestrator → finance worker idempotency (`SatelliteEventProcessed`)
- Smoke: [docs/SMOKE_ALL_SERVICES.md](../docs/SMOKE_ALL_SERVICES.md)
