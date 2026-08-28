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
- [x] K-06…K-11 UI — `/lab-orders/[id]` stepper workflow; step chips carry role hints (nurse/lab tech/doctor/cashier); structural results table (`items[].results`, fallback `resultJson`) replaces raw JSON dump; Print stub
- [x] Lab orders list — `GET /api/lab-orders` paged (`{data,total,page,pageSize}`; status/criticalOnly/modality/patientRefId/dateFrom/dateTo); DATA_TABLE columns (services, patient, modality, status, amount, created); `GET /api/lab-orders/[id]` for the detail page

## K3

- [x] CLI-05 practitioner day matrix — `/appointments` + `GET /api/appointments/calendar`; legacy `/scheduling` page + `GET /api/scheduling/slots` + `getAvailableSlots` **removed** (no redirect stub)
- [x] CLI-35 sidebar cleanup — Setup split into **Catalogs** / **Rules & data**; `/admin/wards` moved under Inpatient module; `/executive` merged into Home for owners (`canViewExecutive`) and route deleted; `/admin/catalog-favorites` merged into `/admin/diagnostic-catalog` favorites tab and route deleted; catalog labels disambiguated (Service prices vs Diagnostic catalog)
- [x] CLI-36 practitioner shift rotation — `PractitionerScheduleRule`/`PractitionerScheduleException`; rule engine (WEEKLY / WEEK_PARITY / MONTH_DAY_PARITY / CYCLE) + per-day hours + exceptions; matrix blocks off-shift slots; create/reschedule guard (409 off-shift); SatAdmin **Shifts** modal on `/admin/master-data` (`GET/PUT /api/admin/practitioners/[id]/schedule`); ADR [clinic-practitioner-shifts.md](../../docs/adr/clinic-practitioner-shifts.md)
- [x] CLI-37 UI list/filter standard — global `EraListFilterBar` instant filters (no Apply; Reset inline; `useDebouncedValue` 300ms); clinic home full-width + shared date; ops/SatAdmin tables name-first + Lucide icon row actions; DESIGN + UI_PLAYBOOK updated
- [x] CLI-38 staff kind + monthly duty roster — `Practitioner.staffKind` (DOCTOR/NURSE/LAB); `StaffDutyRoster`/`StaffDutyLine`/`StaffAbsence`; `/sanatorium/nurse-roster` (head doctor); planner prefers approved posting; clinic-local absences (Finance HR later); ADR [clinic-staff-duty-roster.md](../../docs/adr/clinic-staff-duty-roster.md)
- [x] CLI-39 sanatorium ICD-10 search/picker — WHO ICD-10 2019 `IcdCode`; `GET /api/icd`; `IcdPicker` (`CatalogField` SEARCHABLE) on `/sanatorium`; selectable CATEGORY/LEAF only
- [x] CLI-40 visit + inpatient + print + favorites — `VisitDiagnosis` / `AdmissionDiagnosis`; `/visits/[id]`; `/inpatient` diagnoses modal; print checkup diagnosis block; `/admin/icd-favorites` (pin + retire, no title CRUD)
- [x] CLI-41 platform ICD-10 gateway — orchestrator `GET /platform/v1/catalog/icd10` in-process from shared generator (not data-hub); clinic optional sync
- [x] CLI-42 diagnosis report — `/reports/diagnoses` + `GET /api/reports/diagnoses`
- [x] CLI-49 physio S catalog + order sites — SatAdmin `/admin/physio-sites` (incl. Unmatched queue); `sites[]` + doctor chips + `note`; type-gated fields; `#23` nahiye matcher; coarse `bodyPart` derived
- [x] Discount audit (K-13) — API + visit card modal UI
- [x] Executive dashboard (K-14) — `ExecutiveDashboard` on Home `/` for owners (`canViewExecutive`) + `GET /api/executive/summary` (`BUSINESS_OWNER`); standalone `/executive` route removed (nav cleanup)
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
- [x] `/admin/catalog` — service cache + Finance sync + Nafta price import (`POST /api/admin/catalog/import-nafta`, `packageIncluded` / department filters)
- [x] `/admin/templates` — clinical + program templates
- [x] `/admin/procedure-rules` — compatibility + FIFO sequence rules (modal)
- [x] `/admin/audit` — satellite audit log viewer
- [x] Docker `RUN_SEED` + bootstrap `db:seed:vnext`
- [s] HL7 LIS prod adapter — CSV only until vendor

## Product modules (v1.0)

Source: [MODULES_CATALOG](../../docs/MODULES_CATALOG.md)

- [x] M6: Service catalog cache API + SatAdmin `/admin/catalog` + sync + Nafta import; catalog-driven procedure pricing on create/complete (`resolveProcedureAmount`); `ServiceCatalogKind` (PROCEDURE/DIAGNOSTIC/LAB/VISIT/OTHER) — procedure-type picker uses `kind=PROCEDURE` only
- [x] M5: Critical lab flag UI on publish (beyond refMin/refMax)
- [x] M9: Multi-room drag reschedule
- [x] M14: Telehealth / portal deep link on lab publish

## Planned — v1.1

- [x] M10: EHR templates / CPOE lite
- [x] M10 pack: standard diagnostic + lab templates v1.2 — [DIAGNOSTIC_AND_LAB_CATALOG.md](./DIAGNOSTIC_AND_LAB_CATALOG.md) + `prisma/seed-data/diagnostic-lab-catalog.json` (85 studies, 48 lab panels, ~362 analytes, 13 visits, 7 packages)
- [x] Diagnostic catalog UI — picker on `/lab-orders`, template result form on `/lab-orders/[id]`, favorites tab on `/admin/diagnostic-catalog` (`Tenant.catalogFavoriteCodes` + mode; standalone `/admin/catalog-favorites` route removed)
- [x] Diagnostic catalog **DB source of truth** (CLI-32) - Modality/DiagnosticService/DiagnosticAnalyte; seed from JSON; SatAdmin `/admin/diagnostic-catalog` CRUD - ADR [clinic-diagnostic-catalog-db.md](../../docs/adr/clinic-diagnostic-catalog-db.md)
- [x] Lab order normalization (CLI-32) - `LabOrderItem` + `LabResult`; dual-write legacy `testCode`/`resultJson`; backfill; results read-only after PUBLISHED; `/lab-orders` DATA_TABLE + filters/pagination
- [x] Patient card clinical sections — `/patients/[id]`: contraindications (collapsed by default) → ICD-10 (open episode) → now/next (incl. pending labs ORDERED/COLLECTED/IN_PROGRESS) → results preview → plan preview; history/plan modals; `GET /api/patients/:id/card-summary` + `…/card-feed`; diagnoses `GET/POST/DELETE /api/patients/:id/diagnoses`; admin card limits in settings
- [x] Patient clinical demographics — sex, birthDate→age, blood group, emergency contact on `PatientRef` ops cache; register + card UI (CLI-28 / ADR clinic-patient-clinical-demographics)
- [x] Ops home (Ana səhifə) — `/` day dashboard + `GET /api/ops/day-summary` (appointments, procedures by status/type, queue, labs, overdue; inpatient beds when preset) (CLI-29)
- [x] Patient clinical timeline API (legacy feed) — `GET /api/patients/:id/timeline` (Baku day groups; still available). Linked Appointment+Visit collapse to one visit row (slot `scheduledAt`, href `/visits/[id]`); appointment-only rows remain for slots without a visit.
- [x] Procedure day-ops (CLI-26) — ADR [clinic-procedure-day-ops.md](../../docs/adr/clinic-procedure-day-ops.md): check-in → `CHECKED_IN`; auto-complete by `endsAt`; `NO_SHOW` burns quota + may charge; MANUAL channel + `checkInRequiresQr`; cron auto-complete / no-show sweep; nurse agenda+kanban; bonus = `checkedInAt` + status in CHECKED_IN/COMPLETED
- [x] Multi-resource scheduling (CLI-30) — ADR [clinic-multi-resource-scheduling.md](../../docs/adr/clinic-multi-resource-scheduling.md): Pattern A sanatorium (`ProcedureTypeRequirement` + `PractitionerSkill` + `ProcedureAllocation`); Pattern B outpatient optional `Appointment.resourceId`; SatAdmin skills/requirements on `/admin/master-data` (Add+Edit: resource + STAFF HARD/SOFT; backfill missing reqs); planner honors SOFT (shared nurse pool)
- [x] Scheduling time layers (CLI-26/30/31 follow-up) — ADR [clinic-scheduling-time-layers.md](../../docs/adr/clinic-scheduling-time-layers.md): per-type `resourceGapMinutes` + `patientRestMinutes`; occupying-tail; Nafta gel 10/0/15; laser/darsonval gap 0; paraffin cycle 20; 4-chamber 08–18 gender lunch; SOFT nurse ≠ cabin gap
- [x] Doctor-confirmed FIFO planning (CLI-31) — ADR [clinic-doctor-confirmed-fifo-planning.md](../../docs/adr/clinic-doctor-confirmed-fifo-planning.md): package → `PROPOSED`; doctor `POST /api/procedures/confirm` → `placeConfirmedProcedures`; incremental context from existing orders; `bodyPart` + rotation/substitution rules; peak `extendedEndHour`; seed `prisma/seed-planning-rules.cjs`; bulk-cancel+replace; external lab >90d block; fasting next-morning labs
- [x] Clinic→hotel capacity foresight (CLI-27) — ADR [clinic-hotel-capacity-foresight.md](../../docs/adr/clinic-hotel-capacity-foresight.md): remaining% slot inventory; warn ≤15% / critical blocks medical booking; `SATELLITE_CLINIC_CAPACITY_CHANGED`
- [x] M11: LIS analyzer import
- [x] M12: Insurance / DMS eligibility
- [x] Ops UX wave (2026-07-19) — Tenant working hours in `/admin/settings`; patient registry paginated filters + anamnesis gate; inpatient ward tiles + `/inpatient/census`; matrix horizon/patient filters
- [x] M13: Inpatient / bed management — **SHIPPED** (ADT-light + `/admin/wards` modal CRUD + daily charge cron + census grid)

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

- [x] Appointment create/reschedule conflict check (`detectSchedulingConflict`); id-based drag reschedule on `/appointments` matrix
- [x] Procedure inventory matrix — `/sanatorium/resources` + `available-slots` (hotel-like free/blocked)
- [x] Reception Location matrix UX + nurse mine filter — sticky day board (`ResourceDayMatrix`), calendar `endsAt`/status/procedureCode; `GET /api/procedures?mine=1` STAFF allocation filter on nurse queue
- [x] Visit card + CPOE on `/appointments`; ICD catalog `GET /api/icd`
- [x] `/doctor`, `/nurse`, `/cashier` + nav; clinic role guards
- [x] CLI-33 cashier ops — queue + shift X/Z + unified bill settle (LOCAL/FOLIO/HUB) + receipt history VOID/reprint + over-quota tab (`ProcedureChargeLog`); fiscal remains `[s]` CLI-24
- [x] Catalog sync — Finance URL with local fallback
- [x] Portal token scope; public `/portal`, `/booking`
- [x] Web booking widget → orchestrator `createBookingAppointment` + local appointment

### Sanatorium cross-satellite

- [x] Billing router: `WALK_IN` → finance event; `IN_HOUSE` → hotel `room-charge` MEDICAL
- [x] Nafta dual-run extra tickets: `/reception/extra-tickets` + hotel Elektraweb outbox at issue (not `COMPLETED`); nurse `TICKET_REQUIRED`. HOT-06 remains HEADLESS.
- [x] Hotel lifecycle emit on bus only (no direct hotel→clinic HTTP); orchestrator fan-out → clinic `POST /api/integration/hotel-lifecycle` (entitlement `industry_clinic` + `SatelliteEndpoint` registry); program templates + scheduler service
- [x] Plan 2.9: `notifyClinicCheckIn` removed; `ProcessedEvent` idempotency on lifecycle ingress
- [x] `PRESCRIPTION_ISSUED` / `PROCEDURE_COMPLETED` + retail reserve/write-off endpoints

### Hotel / retail enablers

- [x] Lifecycle dispatch on check-in/out/relocate; orchestrator-gateway mappers for lifecycle events
- [x] `programCode` from `ratePlan.code` when `medicalFlag`
- [x] `SATELLITE_HOTEL_SANATORIUM_BOOKING_CREATED` — early program FIFO on medical reservation (not only check-in)
- [x] `ProcedureType` / `ProcedureRule` / `PatientContraindication`; FIFO `treatment-planner.service`; `useProcedureQuota` on procedure complete
- [x] Capacity risk: `GET /api/capacity/summary`, Home executive band 120–125 guest-equiv/week
- [x] Patient card `/patients/[id]` — body-map contraindications UI

## UI / design tokens (Wave C)

- [x] 3-tier design tokens (L1/L2/L3) + Field* sweep — SatAdmin, patient/lab, sanatorium, ops chrome, remainder ([FIELD_SYSTEM_MODAL_WAVES.md](../../docs/FIELD_SYSTEM_MODAL_WAVES.md) wave **C**; ADR [era-design-tokens-3tier.md](../../docs/adr/era-design-tokens-3tier.md))
- [x] `lint:design-tokens` — era-clinic `raw-input-no-token` = 0

### Env (prod example)

- `ERA_FISCAL_PROVIDER`, `CLINIC_API_URL`, `CLINIC_BRIDGE_SECRET`, `POS_BRIDGE_SECRET`, `HOTEL_PMS_URL`, `RETAIL_POS_URL`, `ORCHESTRATOR_EVENT_URL`, `ERA_GUEST_QR_SECRET`


### 2026-07-22 — CLI-34 print forms

Trilingual print routes (lab/USM/checkup/procedures), tenant branding, qualitative analyte options, ImagingPhrase library, PrintLanguageDialog on patient card and lab workflow.

### Planned — CLI-47 procedure TTK

Docs only (2026-08-21): [clinic-procedure-consumable-ttk.md](../../docs/adr/clinic-procedure-consumable-ttk.md). Dummy `PROC-*` on complete remains until W1.

### W3 — type-gated physio order fields (CLI-49)

2026-08-27: `ProcedureOrder.physioFields` + per-site laterality; `ProcedureType.needsSite` / `physioOrderFields` seeded from SKU; doctor form shows only those fields (`CatalogField`); extra field → 400.

### W4 — unmatched nahiye queue (CLI-49)

2026-08-27: domain matcher (`nahiye-match.ts`) golden-locked to `nahiye-s-match.cjs`; `#23` slots carry `nahiye` (card join via `patientProcedureId`); import copies WO text into `note` (never wipe) and fills `sites[]` / `physioFields`; leftover → `PhysioNahiyeQueue`; SatAdmin Unmatched tab aliases an existing S or marks not-anatomy. Does not auto-mint S. Electro 2/4-pad routing still out of scope.

### Nafta dual-run extra tickets (HOT-06)

2026-08-27: Issue ticket at `/reception/extra-tickets` enqueues hotel `ElektrawebFolioOutbox`; widget `SP_SPA_SAVE`; 3-copy print; nurse gate. Not SHIPPED.
