# Smoke test — all ERA ecosystem services

Run from umbrella root after `cp .env.example .env`.

## Hosts file

```
127.0.0.1 app.era.az api.era.az hotel.era.az pos.era.az retail.era.az logistics.era.az construction.era.az crm.era.az auto.era.az wholesale.era.az clinic.era.az
```

## Docker full stack

```bash
docker compose build
docker compose up -d
docker compose ps
```

## HTTP health (public satellites)

| URL | Expected |
|-----|----------|
| http://hotel.era.az/api/health or /login | 200 |
| http://pos.era.az/api/health or / | 200 |
| http://retail.era.az/api/health | 200 JSON ok |
| http://logistics.era.az/api/health | 200 |
| http://construction.era.az/api/health | 200 |
| http://crm.era.az/api/health | 200 |
| http://auto.era.az/api/health | 200 |
| http://wholesale.era.az/api/health | 200 |
| http://clinic.era.az/api/health | 200 |
| http://api.era.az/auth/login | 405/400 (route alive) |

## Internal (not on Traefik)

- Finance API: `curl http://localhost:4000/api/health` if port published for dev
- Docker network: `http://finance-core:4000/api/health`

## Local build (without Docker)

Per satellite:

```bash
cd era-retail-pos && npm install && npx prisma generate && npm run build
```

Repeat for each new app under `era-*`.

## Orchestrator event path

With stack up and `SATELLITE_EVENT_SERVICE_TOKEN` set:

```bash
curl -X POST http://retail.era.az/api/events/dispatch \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"SATELLITE_RETAIL_SALE_COMPLETED\",\"payload\":{\"outletId\":\"o1\",\"registerId\":\"r1\",\"shiftId\":\"s1\",\"receiptId\":\"rc1\",\"preset\":\"grocery\",\"amountNet\":10,\"currency\":\"AZN\",\"paymentMethod\":\"CASH\",\"lineCount\":1}}"
```

Check orchestrator and finance-core logs for enqueue/worker log line with `transaction=` / `invoice=`.

## Event dispatch per vertical

Set `ERA_SATELLITE_ORGANIZATION_ID` to a valid finance org UUID and ensure org has at least one counterparty for invoice handlers.

| Host | Example `type` |
|------|----------------|
| retail.era.az | `SATELLITE_RETAIL_SALE_COMPLETED` |
| logistics.era.az | `SATELLITE_LOGISTICS_TRIP_COMPLETED` |
| construction.era.az | `SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED` |
| crm.era.az | `SATELLITE_CRM_LEAD_CONVERTED` |
| auto.era.az | `SATELLITE_AUTO_WORK_ORDER_COMPLETED` |
| clinic.era.az | `SATELLITE_CLINIC_VISIT_COMPLETED` |
| wholesale.era.az | `SATELLITE_WHOLESALE_ORDER_CONFIRMED` |

```bash
curl -X POST http://logistics.era.az/api/events/dispatch \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"SATELLITE_LOGISTICS_TRIP_COMPLETED\",\"payload\":{\"tripId\":\"t1\",\"vehicleId\":\"v1\",\"freightAmount\":100,\"currency\":\"AZN\"}}"
```

Finance worker idempotency: table `satellite_events_processed` — replay same `correlationId` should skip.

## Orchestrator membership (S1)

```bash
# Login
curl -s -X POST http://localhost:4100/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"demo.owner@erafinance.local\",\"password\":\"DemoLocal#2026\"}"

# List memberships (Bearer from login)
curl -s http://localhost:4100/memberships -H "Authorization: Bearer <accessToken>"
```

## Vertical MVP E2E (after migrate + seed)

| Vertical | Happy path API |
|----------|----------------|
| Retail R1 | `POST /api/shifts/open` → `POST /api/receipts` → `POST /api/receipts/:id/pay` |
| CRM C1 | `POST /api/leads` → `POST /api/leads/:id/convert` |
| Logistics L1 | `POST /api/trips` → `POST /api/trips/:id/complete` |
| Clinic K1 | `POST /api/appointments` → visit complete |
| Clinic K2 | `POST /api/lab-orders/:id/complete` |
| Construction C1 | `POST /api/acts/:id/approve` |
| Auto A1 | `POST /api/work-orders/:id/complete` |
| Wholesale W1 | `POST /api/orders/:id/confirm` |

## CI checklist (S8)

Run on PR / nightly (see `.github/workflows/ecosystem-smoke.yml`):

1. `npm run build` in `packages/era-contracts`, `packages/satellite-kit`
2. `npm run build` in `era-365-orchestrator/apps/api`
3. Health curls against docker-compose stack (optional job)

## SSO exchange (satellites)

```bash
# After orchestrator issues signed SSO payload:
curl -X POST http://retail.era.az/api/auth/sso/exchange \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"user@example.com\",\"fullName\":\"Demo\",\"organizationId\":\"<org-uuid>\",\"expiresAt\":1999999999,\"signature\":\"<hmac>\"}"
```
