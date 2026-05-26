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

- [ ] LIS file import — **PLANNED (v1.1)** (not blocking portal/pay hooks)
- [ ] Patient portal (deferred module M8)

## K5 — Sanatorium bridge (Wave 3 Nafta)

- [x] `ClinicalEpisode` — `reservationId`, `hotelStayId`, `globalPersonId`, org scope
- [x] `ClinicalComplaint`, `ClinicalDiagnosis`; `LabOrder.clinicalEpisodeId`
- [x] `POST /api/sanatorium/episodes/from-stay` — hotel check-in bridge (public path + `X-Clinic-Bridge-Secret`)
- [x] `/sanatorium` — in-house guest list + episode detail (US-06, US-07)
- [x] Lab results API — `refMin`, `refMax`, `flag` on result lines
- [x] UAT: see [UAT-SMOKE.md](UAT-SMOKE.md) § K5 (if present) or README smoke below

**Migration:** `20260528110000_k5_sanatorium`

**Hotel hook env:** `CLINIC_API_URL`, `CLINIC_BRIDGE_SECRET`, `HOTEL_ORGANIZATION_ID` on era-hotel-pms.

## K6 — Platform add-ons (v1.0)

- [x] Notifications + booking cron (T-24h) — Live
- [x] Portal link on lab publish — `createPortalLink` MVP
- [x] Billing snapshot consumer — `GET /api/platform/billing-snapshot`
- [x] Payment link on visit/lab complete (MVP)
- [x] Delivery/loyalty/domains on lab publish

Client: `@era/satellite-kit`.

## Platform session (v1.0)

- [x] Platform session via SSO — `PlatformSessionBarServer`, executive `canViewExecutive`
- [x] Local operational RBAC unchanged; no local Orch RBAC API (N/A); MDM N/A on satellite

## Operations (v1.0)

- [x] Lab lifecycle + executive summary
- [x] Sanatorium bridge (hotel integration)
- [x] Admin settings UI playbook `/admin/settings`

## Product modules (v1.0)

Source: [MODULES_CATALOG](../../docs/MODULES_CATALOG.md)

- [x] M6: Service catalog cache API + sync from Finance price list stub
- [x] M5: Critical lab flag UI on publish (beyond refMin/refMax)
- [x] M9: Multi-room drag reschedule
- [x] M14: Telehealth / portal deep link on lab publish

## Planned — v1.1

- [ ] M10: EHR templates / CPOE lite
- [ ] M11: LIS analyzer import
- [ ] M12: Insurance / DMS eligibility
- [ ] M13: Inpatient / bed management
