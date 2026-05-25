# Smoke test — all ERA ecosystem services

Run from umbrella root after `cp .env.example .env`.

**Phase A gate:** platform smoke (orchestrator RBAC, control-plane auth, 11 event types, contracts/gov-budget) + vertical E2E samples below.

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

Apply migrations before smoke (see [SETUP_AND_RUN.md](./SETUP_AND_RUN.md)): Finance `20260525180000_contracts_gov_budget`, orchestrator schema.

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

## Orchestrator membership & RBAC

```bash
# Login (demo owner from Finance seed)
TOKEN=$(curl -s -X POST http://localhost:4100/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"demo.owner@erafinance.local\",\"password\":\"DemoLocal#2026\"}" \
  | jq -r .accessToken)

# List memberships
curl -s http://localhost:4100/memberships -H "Authorization: Bearer $TOKEN"

# Join org by VÖEN (orchestrator canonical; Finance proxies same path under /api/auth/join-org)
curl -s -X POST http://localhost:4100/auth/join-org \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"taxId\":\"9900000002\",\"message\":\"Smoke test join\"}"

# List pending access requests (OWNER/ADMIN)
curl -s http://localhost:4100/team/access-requests -H "Authorization: Bearer $TOKEN"

# Approve / decline (replace REQUEST_ID)
curl -s -X POST "http://localhost:4100/team/access-requests/REQUEST_ID/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"role\":\"USER\"}"

# Transfer ownership (OWNER only; replace NEW_OWNER_USER_ID)
curl -s -X POST http://localhost:4100/organizations/transfer-ownership \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"newOwnerUserId\":\"NEW_OWNER_USER_ID\"}"
```

Dispute routes (super-admin Bearer): `POST /admin/organizations/:orgId/disputes`, `GET .../disputes`, `PATCH .../disputes/:id/status`, `POST .../disputes/:id/execute`.

## Control-plane auth on Finance

Set `ERA_AUTH_MODE=control-plane` and shared `ERA_JWT_SECRET`, then:

```bash
curl -s http://localhost:4000/api/subscription/me \
  -H "Authorization: Bearer $TOKEN"
```

Expect 200 with subscription payload when token carries `isOwner: true`.

## Finance contracts & gov budget

Requires module entitlements on the active org (`contract_management_pro`, `gov_budget_pro`).

```bash
# Contract registry
curl -s http://localhost:4000/api/contracts -H "Authorization: Bearer $TOKEN"

# Budget years (use Demo Budget Agency org context)
curl -s http://localhost:4000/api/gov-budget/years -H "Authorization: Bearer $TOKEN"

# Budget limit check
curl -s -X POST http://localhost:4000/api/gov-budget/check-limit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"budgetLineId\":\"<uuid>\",\"amount\":100}"
```

Web UI: `/contracts`, `/gov-budget` on Finance web `:3000`.

## Orchestrator event path

With stack up and `SATELLITE_EVENT_SERVICE_TOKEN` set:

```bash
curl -X POST http://retail.era.az/api/events/dispatch \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"SATELLITE_RETAIL_SALE_COMPLETED\",\"payload\":{\"outletId\":\"o1\",\"registerId\":\"r1\",\"shiftId\":\"s1\",\"receiptId\":\"rc1\",\"preset\":\"grocery\",\"amountNet\":10,\"currency\":\"AZN\",\"paymentMethod\":\"CASH\",\"lineCount\":1}}"
```

Check orchestrator and finance-core logs for enqueue/worker log line with `transaction=` / `invoice=`.

## All 11 event types — dispatch smoke

Set `ERA_SATELLITE_ORGANIZATION_ID` to a valid finance org UUID and ensure org has at least one counterparty for invoice handlers.

| # | Host | `type` | Worker log hint |
|---|------|--------|-----------------|
| 1 | hotel.era.az | `SATELLITE_HOTEL_RESERVATION_COMPLETED` | `transaction=` + `invoice=` |
| 2 | retail.era.az | `SATELLITE_RETAIL_SALE_COMPLETED` | `transaction=` + `invoice=` |
| 3 | retail.era.az | `SATELLITE_RETAIL_SHIFT_CLOSED` | `Retail shift closed (cash recon stub)` |
| 4 | logistics.era.az | `SATELLITE_LOGISTICS_TRIP_COMPLETED` | `transaction=` |
| 5 | construction.era.az | `SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED` | `transaction=` + `invoice=` |
| 6 | crm.era.az | `SATELLITE_CRM_LEAD_CONVERTED` | `transaction=` + `invoice=` |
| 7 | crm.era.az | `SATELLITE_CRM_VISIT_LOGGED` | `CRM visit logged:` |
| 8 | auto.era.az | `SATELLITE_AUTO_WORK_ORDER_COMPLETED` | `transaction=` + `invoice=` |
| 9 | clinic.era.az | `SATELLITE_CLINIC_VISIT_COMPLETED` | `transaction=` + `invoice=` |
| 10 | clinic.era.az | `SATELLITE_CLINIC_LAB_ORDER_COMPLETED` | `transaction=` + `invoice=` |
| 11 | wholesale.era.az | `SATELLITE_WHOLESALE_ORDER_CONFIRMED` | `transaction=` + `invoice=` |

Example payloads:

```bash
# Logistics trip
curl -X POST http://logistics.era.az/api/events/dispatch \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"SATELLITE_LOGISTICS_TRIP_COMPLETED\",\"payload\":{\"tripId\":\"t1\",\"vehicleId\":\"v1\",\"freightAmount\":100,\"currency\":\"AZN\"}}"

# Logistics L2 — POD + fuel + rollup (after trip created)
curl -X POST http://logistics.era.az/api/trips/<id>/pod -H "Content-Type: application/json" \
  -d "{\"recipient\":\"Warehouse B\",\"notes\":\"Signed by manager\"}"
curl -X POST http://logistics.era.az/api/trips/<id>/fuel-report -H "Content-Type: application/json" \
  -d "{\"liters\":45.5,\"cost\":68.25}"
curl "http://logistics.era.az/api/reports/fuel?from=2026-05-01&to=2026-05-31"

# Retail shift closed
curl -X POST http://retail.era.az/api/events/dispatch \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"SATELLITE_RETAIL_SHIFT_CLOSED\",\"payload\":{\"shiftId\":\"s1\",\"outletId\":\"o1\",\"registerId\":\"r1\",\"preset\":\"grocery\",\"totalSales\":500,\"receiptCount\":12,\"currency\":\"AZN\"}}"

# CRM visit logged
curl -X POST http://crm.era.az/api/events/dispatch \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"SATELLITE_CRM_VISIT_LOGGED\",\"payload\":{\"visitId\":\"v1\",\"leadId\":\"l1\",\"channel\":\"visit\"}}"

# Clinic lab order completed
curl -X POST http://clinic.era.az/api/events/dispatch \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"SATELLITE_CLINIC_LAB_ORDER_COMPLETED\",\"payload\":{\"labOrderId\":\"lo1\",\"patientRef\":\"p1\",\"testCode\":\"CBC\",\"amountNet\":25,\"currency\":\"AZN\"}}"
```

Finance worker idempotency: table `satellite_events_processed` — replay same `correlationId` should skip.

## Vertical MVP E2E (Phase B depth APIs)

| Vertical | Happy path API |
|----------|----------------|
| Retail R1 | `POST /api/shifts/open` → `POST /api/receipts` → `POST /api/receipts/:id/pay` |
| Retail R3 | `POST /api/receipts/:id/void`, `POST /api/receipts/:id/return`, `POST /api/shifts/close` |
| Retail R2 | `GET /api/presets` |
| CRM C1 | `POST /api/leads` → `POST /api/leads/:id/convert` |
| CRM C2 | `GET/POST /api/visits` |
| Logistics L1 | `POST /api/trips` → `POST /api/trips/:id/complete` |
| Logistics L2 | `GET/PATCH /api/trips/:id`, `GET/POST /api/trips/:id/pod`, `GET/POST /api/trips/:id/fuel-report`, `GET /api/reports/fuel?from=&to=` |
| Clinic K1 | `POST /api/appointments` → visit complete |
| Clinic K2 | `POST /api/lab-orders/:id/complete`, `GET /api/lab-orders?status=` |
| Clinic K3 | `GET /api/scheduling/slots` |
| Construction C1 | `POST /api/acts/:id/approve` |
| Construction C2 | `GET/POST /api/material-requisitions` |
| Auto A1 | `POST /api/work-orders/:id/complete` |
| Auto A2 | `GET/POST /api/appointments` |
| Wholesale W1 | `POST /api/orders/:id/confirm` |
| Wholesale W2 | `GET/POST /api/pick-lists`, `GET /api/credit-limit?counterpartyId=` |

## CI checklist (S8 / PP7)

Run on PR / nightly (see `.github/workflows/ecosystem-smoke.yml`):

1. `npm run build` in `packages/era-contracts`, `packages/satellite-kit`
2. `npm run build` in `era-365-orchestrator/apps/api`, `era-finance-core/apps/api`
3. Health curls against docker-compose stack (optional job)

## SSO exchange (satellites)

All 7 industry apps use `executeSatelliteSsoExchange` — session includes `BUSINESS_OWNER` when orchestrator SSO body has `financeRole: "OWNER"`.

```bash
# After orchestrator issues signed SSO payload:
curl -X POST http://retail.era.az/api/auth/sso/exchange \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"user@example.com\",\"fullName\":\"Demo\",\"organizationId\":\"<org-uuid>\",\"financeRole\":\"OWNER\",\"expiresAt\":1999999999,\"signature\":\"<hmac>\"}"
```

Verify response `user.role` is `BUSINESS_OWNER` and `user.isOwner` is `true`.
