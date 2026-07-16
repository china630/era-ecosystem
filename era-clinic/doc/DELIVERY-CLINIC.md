# DELIVERY-CLINIC

PRD: [../PRD.md](../PRD.md)

## K0 (done)

- [x] PRD v1.1, scaffold, SSO, `/appointments` placeholder

## K1 — MVP приём

- [x] Patient ref API + `/patients` registry UI (M1)
- [x] Practitioner + room models; SatAdmin CRUD `/admin/master-data` (M2)
- [x] Schedule + check-in (K-02) — `/appointments`
- [x] Appointment create UI (K-01) — modal on `/appointments`
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
- [x] Discount audit (K-13) — API + visit card modal UI
- [x] Executive dashboard (K-14) — `/executive` + `GET /api/executive/summary` (`BUSINESS_OWNER`)
- [x] Multi-room schedule (drag reschedule) — см. Product modules M9 (v1.0)

## K4

- [x] LIS file import — **v1.1** (M11)
- [x] Patient portal (deferred module M8) — `/portal` + `/api/portal/session`

## K5 — Sanatorium bridge (Wave 3 Nafta)

- [x] `ClinicalEpisode` — `reservationId`, `hotelStayId`, `globalPersonId`, org scope
- [x] `ClinicalComplaint`, `ClinicalDiagnosis`; `LabOrder.clinicalEpisodeId`
- [x] `POST /api/sanatorium/episodes/from-stay` — hotel check-in bridge (public path + `X-Clinic-Bridge-Secret`)
- [x] `/sanatorium` — in-house guest list + episode detail (US-06, US-07)
- [x] Treatment chart — `GET /api/sanatorium/episodes/[id]/schedule`, program quota on episode detail, `POST ?action=instantiate-program`
- [x] `/sanatorium` treatment chart UI — date picker, procedure slots, quota summary (Wave C Nafta)
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
- [x] Admin settings UI `/admin/settings` — persisted via `/api/admin/settings`

## Admin master data (2026-06-15)

Coverage: [COVERAGE_MATRIX CLI-*](../../docs/COVERAGE_MATRIX.md#era-clinic-cli)

- [x] `/admin/master-data` — practitioners ops catalog (specialty, slots); hire via CP Workforce when `cp_workforce` (`GET /platform/v1/workforce/policy`); POST practitioners **403** when CP hire active
- [x] `/admin/wards` — ward/bed create+edit+delete modals
- [x] `/patients` — registry list + create modal (M1)
- [x] `/admin/catalog` — service cache + Finance sync (M6)
- [x] `/admin/templates` — clinical + program templates
- [x] `/admin/procedure-rules` — compatibility + FIFO sequence rules (modal)
- [x] `/admin/audit` — satellite audit log viewer
- [x] Docker `RUN_SEED` + bootstrap `db:seed:vnext`
- [s] HL7 LIS prod adapter — CSV only until vendor

## Product modules (v1.0)

Source: [MODULES_CATALOG](../../docs/MODULES_CATALOG.md)

- [x] M6: Service catalog cache API + SatAdmin `/admin/catalog` + sync
- [x] M5: Critical lab flag UI on publish (beyond refMin/refMax)
- [x] M9: Multi-room drag reschedule
- [x] M14: Telehealth / portal deep link on lab publish

## Planned — v1.1

- [x] M10: EHR templates / CPOE lite
- [x] M10 pack: standard diagnostic + lab templates v1.1 — [DIAGNOSTIC_AND_LAB_CATALOG.md](./DIAGNOSTIC_AND_LAB_CATALOG.md) + `prisma/seed-data/diagnostic-lab-catalog.json` (85 studies, 45 lab panels, 13 visits, 7 packages → `ClinicalTemplate` + `ServiceCatalogCache`)
- [x] Diagnostic catalog UI — picker on `/lab-orders`, template result form on `/lab-orders/[id]`, favorites admin `/admin/catalog-favorites` (`Tenant.catalogFavoriteCodes` + mode)
- [x] Patient card clinical sections — `/patients/[id]`: contraindications → now/next (incl. pending labs ORDERED/COLLECTED/IN_PROGRESS) → results preview → plan preview; history/plan modals; `GET /api/patients/:id/card-summary` + `…/card-feed`; admin card limits in settings
- [x] Patient clinical demographics — sex, birthDate→age, blood group, emergency contact on `PatientRef` ops cache; register + card UI (CLI-28 / ADR clinic-patient-clinical-demographics)
- [x] Patient clinical timeline API (legacy feed) — `GET /api/patients/:id/timeline` (Baku day groups; still available)
- [x] Procedure day-ops (CLI-26) — ADR [clinic-procedure-day-ops.md](../../docs/adr/clinic-procedure-day-ops.md): statuses `CHECKED_IN`/`NO_SHOW`; reception matrix DnD + available-slots; nurse QR check-in (grace −5/+15); complete only after check-in
- [x] Clinic→hotel capacity foresight (CLI-27) — ADR [clinic-hotel-capacity-foresight.md](../../docs/adr/clinic-hotel-capacity-foresight.md): remaining% slot inventory; warn ≤15% / critical blocks medical booking; `SATELLITE_CLINIC_CAPACITY_CHANGED`
- [x] M11: LIS analyzer import
- [x] M12: Insurance / DMS eligibility
- [x] M13: Inpatient / bed management — **SHIPPED** (ADT-light + `/admin/wards` modal CRUD + daily charge cron)

## vNext — Clinic + shared fiscal (2026-06)

ADR: [sanatorium-vnext.md](../../docs/adr/sanatorium-vnext.md). Migration: `20260603120000_clinic_vnext`.

### Foundation

- [x] `@era/contracts` — `globalPersonId` envelope; `SATELLITE_CLINIC_PROCEDURE_COMPLETED`, `PRESCRIPTION_ISSUED`; hotel `GUEST_CHECKED_IN/OUT`, `ROOM_CHANGED`
- [x] Orchestrator guest QR issue/verify + `satellite-kit` helpers; clinic `PatientRef.globalPersonId`
- [x] Finance `AccountingAdapter` + dispatch handlers for new clinic/hotel events
- [x] `patientOrigin` / `billingTarget` on Visit/Episode; enums for appointment/visit status

### `@era/fiscal`

- [s] `@era/fiscal` NBC/Cybernet — mock/stub until prod cert

### Clinic UX

- [x] Resource-aware `GET /api/scheduling/slots` (includes `appointmentId` on busy slots); id-based drag reschedule UI
- [x] Procedure inventory matrix — `/sanatorium/resources` + `available-slots` (hotel-like free/blocked)
- [x] Visit card + CPOE on `/appointments`; ICD catalog `GET /api/icd`
- [x] `/doctor`, `/nurse`, `/cashier` + nav; clinic role guards
- [x] Catalog sync — Finance URL with local fallback
- [x] Portal token scope; public `/portal`, `/booking`
- [x] Web booking widget → orchestrator `createBookingAppointment` + local appointment

### Sanatorium cross-satellite

- [x] Billing router: `WALK_IN` → finance event; `IN_HOUSE` → hotel `room-charge` MEDICAL
- [x] Hotel lifecycle emit on bus only (no direct hotel→clinic HTTP); orchestrator fan-out → clinic `POST /api/integration/hotel-lifecycle` (entitlement `industry_clinic` + `SatelliteEndpoint` registry); program templates + scheduler service
- [x] Plan 2.9: `notifyClinicCheckIn` removed; `ProcessedEvent` idempotency on lifecycle ingress
- [x] `PRESCRIPTION_ISSUED` / `PROCEDURE_COMPLETED` + retail reserve/write-off endpoints

### Hotel / retail enablers

- [x] Lifecycle dispatch on check-in/out/relocate; orchestrator-gateway mappers for lifecycle events
- [x] `programCode` from `ratePlan.code` when `medicalFlag`
- [x] `SATELLITE_HOTEL_SANATORIUM_BOOKING_CREATED` — early program FIFO on medical reservation (not only check-in)
- [x] `ProcedureType` / `ProcedureRule` / `PatientContraindication`; FIFO `treatment-planner.service`; `useProcedureQuota` on procedure complete
- [x] Capacity risk: `GET /api/capacity/summary`, `/executive` band 120–125 guest-equiv/week
- [x] Patient card `/patients/[id]` — body-map contraindications UI

### Env (prod example)

- `ERA_FISCAL_PROVIDER`, `CLINIC_API_URL`, `CLINIC_BRIDGE_SECRET`, `POS_BRIDGE_SECRET`, `HOTEL_PMS_URL`, `RETAIL_POS_URL`, `ORCHESTRATOR_EVENT_URL`, `ERA_GUEST_QR_SECRET`
