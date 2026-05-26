# Smoke test — all ERA ecosystem services

Run from umbrella root after `cp .env.example .env`.

**Phase A gate:** platform smoke (orchestrator RBAC, control-plane auth, 13 ingress event types, contracts/gov-budget) + vertical E2E samples below.

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

## All 13 ingress event types — dispatch smoke

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
| 12 | hotel.era.az | `SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED` | multi-line NAS journal |
| 13 | hotel.era.az | `SATELLITE_HOTEL_INVOICE_ISSUED` | draft sales invoice |
| 14 | hotel.era.az | `SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT` | agency CL meta |

### Idempotency replay

1. Dispatch any handler row above with `correlationId: "smoke-idem-001"`.
2. Replay the **same** payload and `correlationId` — Finance must log skip (no second GL line / invoice).

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
| Construction C2 | `GET/POST /api/material-requisitions`, `GET /api/projects/:id/plan-vs-actual` |
| Auto A1 | `POST /api/work-orders/:id/complete` |
| Auto A2 | `GET/POST /api/appointments`, UI `/appointments` |
| Wholesale W1 | `POST /api/orders/:id/confirm` |
| Wholesale W2 | `GET/POST /api/pick-lists`, `PATCH /api/pick-lists/:id/lines/:lineId`, `GET /api/credit-limit?counterpartyId=` |

## F&B POS + hotel bridge (Wave 2 / SP3)

With `docker compose up -d fb-pos hotel-pms` (or local `:3200` / `:3000`):

```bash
# FB login (session cookie for RBAC)
curl -c /tmp/fb-cookies.txt -X POST http://localhost:3200/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"waiter","password":"waiter"}'

curl -b /tmp/fb-cookies.txt http://localhost:3200/api/menu

# Shift + ticket flow
curl -b /tmp/fb-cookies.txt -X POST http://localhost:3200/api/shifts/open \
  -H "Content-Type: application/json" \
  -d '{"outletCode":"RESTAURANT","openingCash":100}'

curl http://localhost:3200/api/tables

# Hotel PMS bridge regression (hotel-pms must be running)
node era-hotel-pms/scripts/test-pos-bridge.mjs
```

Room charge from fb-pos uses `HOTEL_PMS_URL`; stub with `FB_POS_PMS_STUB=1` for offline dev.

## CI checklist (S8 / PP7)

Run on PR / nightly (see `.github/workflows/ecosystem-smoke.yml`):

1. `npm run build` in `packages/era-contracts`, `packages/satellite-kit`
2. `npm run build` in `era-365-orchestrator/apps/api`, `era-finance-core/apps/api`
3. Health curls against docker-compose stack (optional job)

## Hospitality Nafta — Wave 3 / 4 (hotel, clinic, MDM, fb-pos)

Requires hotel-pms @ `:3000`, clinic @ `:3300`, orchestrator @ `:4100`, fb-pos @ `:3200` after seed.

```bash
# HN-1 — night audit package EOD (reception session cookie or Bearer)
curl -s -X POST http://localhost:3000/api/night-audit/run -H "Cookie: era_hotel_session=..."

# HN-2 — procedure schedule
curl -s http://localhost:3000/api/procedures -H "Cookie: era_hotel_session=..."
curl -s -X POST http://localhost:3000/api/procedures/appointments \
  -H "Content-Type: application/json" -H "Cookie: era_hotel_session=..." \
  -d '{"reservationId":"<id>","serviceId":"<id>","startAt":"2026-06-01T10:00:00Z","endAt":"2026-06-01T11:00:00Z"}'

# HN-3 — clinic episode from stay (bridge secret if set)
curl -s -X POST http://localhost:3300/api/sanatorium/episodes/from-stay \
  -H "Content-Type: application/json" \
  -d '{"reservationId":"<id>","guestName":"Ali","passportNumber":"AA123","organizationId":"nafta-sanatorium-org"}'
curl -s http://localhost:3300/api/sanatorium/episodes -H "Cookie: era_clinic_session=..."

# HN-P — MDM health + org register (internal)
curl -s http://localhost:4100/internal/v1/mdm/health

# HN-7 — transfers
curl -s http://localhost:3000/api/transfers -H "Cookie: era_hotel_session=..."

# HN-8 — banquets + fb-pos ticket
curl -s http://localhost:3000/api/banquets -H "Cookie: era_hotel_session=..."
curl -s -X POST http://localhost:3200/api/tickets \
  -H "Content-Type: application/json" -H "Cookie: era_fb_session=..." \
  -d '{"outletCode":"BANQUET","beoId":"<beo-uuid>","covers":50}'
```

## Hospitality Nafta — Wave 5 (GL, invoices, contract pricing)

Requires hotel-pms @ `:3000`, optional orchestrator @ `:4100` + finance worker for GL journal smoke.

```bash
# NW-1 — revenue GL mappings + night audit E1
curl -s http://localhost:3000/api/master/revenue-gl-mappings -H "Cookie: era_hotel_session=..."
curl -s -X POST http://localhost:3000/api/night-audit/run -H "Cookie: era_hotel_session=..."

# NW-2 — invoice center + agency CL
curl -s http://localhost:3000/api/reports/invoices -H "Cookie: era_hotel_session=..."
curl -s -X PATCH http://localhost:3000/api/reports/invoices/<fiscal-doc-id> \
  -H "Content-Type: application/json" -H "Cookie: era_hotel_session=..." \
  -d '{"integrateToAccounting":true}'
curl -s "http://localhost:3000/api/reports/agency-cl-summary?from=2026-05-01&to=2026-05-31" \
  -H "Cookie: era_hotel_session=..."

# NW-3 — contract pricing quote
curl -s "http://localhost:3000/api/bookings/quote?ratePlanId=<uuid>&checkInDate=2026-06-01&checkOutDate=2026-06-05&agencyId=<uuid>" \
  -H "Cookie: era_hotel_session=..."

# NW-4 — stop-sell (regression)
curl -s http://localhost:3000/api/channel/stop-sell -H "Cookie: era_hotel_session=..."
```

## SSO exchange (satellites)

All 7 industry apps use `executeSatelliteSsoExchange` — session includes `BUSINESS_OWNER` when orchestrator SSO body has `financeRole: "OWNER"`.

```bash
# After orchestrator issues signed SSO payload:
curl -X POST http://retail.era.az/api/auth/sso/exchange \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"user@example.com\",\"fullName\":\"Demo\",\"organizationId\":\"<org-uuid>\",\"financeRole\":\"OWNER\",\"expiresAt\":1999999999,\"signature\":\"<hmac>\"}"
```

Verify response `user.role` is `BUSINESS_OWNER` and `user.isOwner` is `true`.

## Wave E — Platform commerce + booking (SP5)

With `ERA_SATELLITE_ORGANIZATION_ID` and orchestrator `@ :4100`:

| Satellite | Smoke trigger | CP APIs exercised |
|-----------|---------------|-------------------|
| construction | `POST /api/progress-acts/{id}/approve` | portal, pay, booking `site-visit` |
| crm-field | `POST /api/leads/{id}/convert` | portal, pay, shipment, appointment |
| wholesale | `POST /api/orders/{id}/confirm` | portal, pay, shipment, pickup slot |
| logistics | `POST /api/trips/{id}/complete` | portal, pay, shipment, delivery slot |
| fb-pos | `POST /api/tickets/{id}/pay` | portal, pay, `fb-table-{id}` slot |
| hotel-pms | issue folio invoice | portal, pay; `GET /api/hotel/integration-settings` → `platformSubscription` |

Orchestrator: `GET /platform/booking/v1/slots?resourceKey=pickup` (Bearer org token). Full checklist: [UAT-SMOKE-PLATFORM.md](../era-365-orchestrator/doc/UAT-SMOKE-PLATFORM.md) § Wave E.

## Wave F — §4 coverage (delivery, loyalty, domains)

| Satellite | Trigger | Body flags | CP APIs |
|-----------|---------|------------|---------|
| hotel-pms | folio invoice + `PATCH /api/hotel/integration-settings` | `customHostname` | delivery, loyalty, domain |
| fb-pos | `POST /api/tickets/{id}/pay` | `delivery`, `customHostname` | shipment, promotion, domain |
| auto-sto | work order complete | `partsDelivered`, `customHostname` | shipment, promotion, domain |
| clinic | lab publish | `homeDelivery`, `customHostname` | shipment, promotion, domain |
| retail / wholesale / logistics / construction / crm | pay or confirm routes | `customHostname` (where applicable) | promotion, domain |

Regenerate matrix §4: `node scripts/readiness-coverage.mjs`. Consumer-only %: `node scripts/readiness-coverage.mjs --consumer-only`.

## Quartet E2E — Finance · Orchestrator · Hotel · FB (SP6 Track A)

Product core for Nafta F&B + PMS. Full checklist: [QUARTET_UAT.md](./QUARTET_UAT.md).

```bash
# Health (no auth)
node scripts/quartet-smoke.mjs

# PMS ↔ FB bridge
node era-hotel-pms/scripts/test-pos-bridge.mjs

# Finance CP (local)
# ERA_AUTH_MODE=control-plane on finance-core → login → GET billing summary

# Platform Wave E/F on staging with ERA_SATELLITE_ORGANIZATION_ID
# See era-365-orchestrator/doc/UAT-SMOKE-PLATFORM.md
```

| Service | Dev URL | Health |
|---------|---------|--------|
| orchestrator | http://127.0.0.1:4100 | `/health` |
| finance-api | http://127.0.0.1:4000 | `/api/health` |
| hotel-pms | http://127.0.0.1:3000 | `/api/health` |
| fb-pos | http://127.0.0.1:3200 | `/api/health` |

## W1-E — Industry enrichment (Wave 1 quartet)

After `npx prisma db push` (or migrate) per app DB:

### era-retail-pos (:3300)

```bash
# Product cache search (seed on first run)
curl -s "http://localhost:3300/api/products/search?q=milk"

# X-report (open shift id from POST /api/shifts/open)
curl -s http://localhost:3300/api/shifts/<SHIFT_ID>/x-report

# Apply promo on open receipt
curl -s -X POST http://localhost:3300/api/receipts/<RECEIPT_ID>/apply-promo \
  -H "Content-Type: application/json" \
  -d '{"discountPercent":10}'
```

### era-crm-field (:3303)

```bash
curl -s -X POST http://localhost:3303/api/visits \
  -H "Content-Type: application/json" \
  -d '{"leadId":"<id>","latitude":40.4093,"longitude":49.8671,"addressLabel":"Baku"}'

curl -s -X PATCH http://localhost:3303/api/leads/<id>/follow-up \
  -H "Content-Type: application/json" \
  -d '{"nextContactAt":"2026-06-01T10:00:00.000Z"}'
```

### era-clinic (:3306)

```bash
curl -s http://localhost:3306/api/catalog/services
curl -s -X POST http://localhost:3306/api/catalog/sync
curl -s "http://localhost:3306/api/lab-orders?criticalOnly=true"
```

### era-logistics (:3304)

```bash
curl -s -X POST http://localhost:3304/api/trips/<id>/waybill
curl -s http://localhost:3304/api/fleet/alerts
curl -s -X POST http://localhost:3304/api/trips/<id>/pod \
  -H "Content-Type: application/json" \
  -d '{"recipient":"Ali M.","podPhotoUrl":"https://example.com/pod.jpg"}'
```

## W2-E — Industry enrichment (Wave 2)

### era-construction

```bash
curl -s -X POST http://localhost:3305/api/projects/<PROJECT_ID>/daily-logs \
  -H "Content-Type: application/json" \
  -d '{"logDate":"2026-05-28","crewCount":12,"notes":"Concrete pour"}'
```

### era-auto-sto

```bash
curl -s "http://localhost:3307/api/vehicles/history?plate=10-AA-001"
curl -s -X POST http://localhost:3307/api/work-orders/<WO_ID>/intake \
  -H "Content-Type: application/json" \
  -d '{"vin":"WVWZZZ","intakeNotes":"Front bumper damage"}'
```

### era-wholesale

```bash
curl -s http://localhost:3308/api/pick-waves
curl -s -X POST http://localhost:3308/api/orders/<ORDER_ID>/ttn
```

### era-retail-pos (BOPIS)

```bash
curl -s -X POST http://localhost:3300/api/receipts/<RECEIPT_ID>/bopis \
  -H "Content-Type: application/json" \
  -d '{"pickupSlotKey":"pickup","customerPhone":"+994501234567"}'
```

### era-logistics (multi-stop)

```bash
curl -s -X POST http://localhost:3304/api/trips/<TRIP_ID>/points \
  -H "Content-Type: application/json" \
  -d '{"points":[{"addressLabel":"Stop 1"},{"addressLabel":"Stop 2"}]}'
curl -s http://localhost:3304/api/driver/trips
curl -s http://localhost:3304/api/tracking/<TRACKING_TOKEN>
```

### era-crm-field (scoring)

```bash
curl -s -X POST http://localhost:3303/api/leads/<LEAD_ID>/score
curl -s "http://localhost:3303/api/leads?sort=score"
```

### era-clinic

```bash
curl -s -X PATCH http://localhost:3306/api/appointments/<ID>/reschedule \
  -H "Content-Type: application/json" \
  -d '{"scheduledAt":"2026-06-01T09:00:00.000Z","roomCode":"RM-2"}'
```

### era-fb-pos

```bash
curl -s http://localhost:3200/api/delivery-inbox
curl -s -X POST http://localhost:3200/api/tickets/<TICKET_ID>/fire-course \
  -H "Content-Type: application/json" \
  -d '{"courseNumber":2,"delayMinutes":5}'
```

### era-hotel-pms

```bash
curl -s http://localhost:3000/api/admin/yield-rules
curl -s http://localhost:3000/api/admin/maintenance
curl -s "http://localhost:3000/api/room-service/qr?roomId=101"
```
