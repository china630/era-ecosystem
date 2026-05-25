# DELIVERY-CLINIC

PRD: [../PRD.md](../PRD.md)

## K0 (done)

- [x] PRD v1.1, scaffold, SSO, `/appointments` placeholder

## K1 — MVP приём

- [x] Patient ref + practitioner + room
- [x] Schedule + check-in (K-01, K-02)
- [x] Visit services + close → `SATELLITE_CLINIC_VISIT_COMPLETED` E2E

## K2 — Лаборатория

- [x] LabOrder model — `visitId`, `collectedAt`, `resultJson`, `publishedAt`
- [x] Status lifecycle — `ORDERED → COLLECTED → RESULT_READY → PUBLISHED → COMPLETED`
- [x] K-06 — `POST /api/lab-orders` with `visitId`, `testCodes[]`
- [x] K-08 — `POST /api/lab-orders/[id]/collect`
- [x] K-09 — `POST /api/lab-orders/[id]/results`
- [x] K-10 — `POST /api/lab-orders/[id]/publish`
- [x] K-11 — `POST /api/lab-orders/[id]/complete` → `SATELLITE_CLINIC_LAB_ORDER_COMPLETED`
- [x] K-06…K-11 UI — `/lab-orders/[id]` stepper workflow
- [x] Lab orders list — `GET /api/lab-orders?status=`

## K3

- [x] Scheduling day view stub — `/scheduling` + `GET /api/scheduling/slots`
- [x] Discount audit (K-13) — `VisitDiscountAudit`, `POST /api/visits/[id]/discount`
- [x] Executive dashboard (K-14) — `/executive` + `GET /api/executive/summary` (`BUSINESS_OWNER`)
- [ ] Multi-room schedule (drag reschedule — deferred MVP+)

## K4

- [ ] LIS file import stub
- [ ] Patient portal (deferred module M8)
