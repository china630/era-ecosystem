# UAT smoke — era-clinic

## Platform

- [ ] `GET /api/health` → 200
- [ ] Home page loads
- [ ] `POST /api/events/dispatch` (with orchestrator running)

## K2 — Lab order lifecycle

1. `POST /api/lab-orders` with `visitId`, `testCodes[]`, patient ref → status `ORDERED`
2. Open `/lab-orders/[id]` — stepper UI loads
3. `POST /api/lab-orders/[id]/collect` → `COLLECTED`, `collectedAt` set
4. `POST /api/lab-orders/[id]/results` with `{ lines: [{ code, value }] }` → `RESULT_READY`
5. `POST /api/lab-orders/[id]/publish` → `PUBLISHED`, `publishedAt` set
6. `POST /api/lab-orders/[id]/complete` → `COMPLETED` + `SATELLITE_CLINIC_LAB_ORDER_COMPLETED` event

## K3 — Admin

- [ ] `/scheduling` — day grid loads from `GET /api/scheduling/slots?date=`
- [ ] `POST /api/visits/[id]/discount` — `CLINIC_ADMIN` or `BUSINESS_OWNER` only; audit row created
- [ ] `/executive` — `BUSINESS_OWNER` sees visits today, lab revenue, open orders
- [ ] `GET /api/executive/summary` — 403 for non-owner roles
