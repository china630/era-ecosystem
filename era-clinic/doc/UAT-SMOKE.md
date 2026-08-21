# UAT smoke — era-clinic





## SSO paths (platform entry � v1.0)

### Owner path (Orchestrator)
1. Login at Orchestrator web: `http://localhost:3000` ([QUARTET_UAT.md](../../docs/QUARTET_UAT.md)).
2. Home → industry tile → **Open** → satellite `/sso/callback` session.
3. Smoke: `node scripts/sso-launch-smoke.mjs` (`ERA_SSO_SHARED_SECRET` aligned).

### Ops path (local)
1. Use this app's `/login` and seed users in sections below.
2. Billing, team, register → Orchestrator only (no satellite `/register`).



## Platform

- [ ] `GET /api/health` → 200
- [x] Home page loads — **`/`** ops day dashboard: today’s appointment/procedure KPIs, by-status and by-type, queue/labs/overdue; change date (Asia/Baku); quick links
- [ ] `POST /api/events/dispatch` (with orchestrator running)

## K2 — Lab order lifecycle

1. `POST /api/lab-orders` with `visitId`, `testCodes[]`, patient ref → status `ORDERED`
2. Open `/lab-orders/[id]` — stepper UI loads
3. `POST /api/lab-orders/[id]/collect` → `COLLECTED`, `collectedAt` set
4. `POST /api/lab-orders/[id]/results` with `{ lines: [{ code, value }] }` → `RESULT_READY`
5. `POST /api/lab-orders/[id]/publish` → `PUBLISHED`, `publishedAt` set; if patient `phone` is email-shaped → orchestrator notification (EMAIL) when `CONTROL_PLANE_URL` + token configured
6. `POST /api/lab-orders/[id]/complete` → `COMPLETED` + `SATELLITE_CLINIC_LAB_ORDER_COMPLETED` event
7. **`/lab-orders`** — DATA_TABLE list (services/patient/modality/status/amount/created), filter bar (status, critical only, modality, patient, date from/to) + Apply/Reset, `ListPaginationFooter` page/pageSize
8. **`/lab-orders/[id]`** — structural results table (no raw JSON); results re-editable while `RESULT_READY` (before publish); read-only once `PUBLISHED`/`COMPLETED`; Print button shows "coming soon" notice; step chips show role hint

## K2b — Appointment notifications (Nafta W0)

1. `POST /api/appointments` with patient phone → SMS notification via orchestrator when entitled (`ERA_NOTIFICATIONS_PACK` on control plane).

## K3 — Admin

- [ ] `/appointments` — practitioner day matrix from `GET /api/appointments/calendar?date=`
- [ ] CLI-36 shifts: `/admin/master-data` → practitioner **Shifts** → add a WEEKLY rule (Mon–Wed 09:00–14:00), Save; on `/appointments` that doctor's Thu/Fri + afternoon cells are blocked (off-shift); booking an off-shift slot returns 409; a doctor with no rules stays fully available
- [ ] `POST /api/visits/[id]/discount` — `CLINIC_ADMIN` or `BUSINESS_OWNER` only; audit row created
- [ ] Home `/` (owner, `canViewExecutive`) — `ExecutiveDashboard` renders as first block above ops summary; date + practitioner filters; KPI from `GET /api/executive/summary`
- [ ] Home `/` (non-owner role) — no executive block; only ops day summary
- [ ] `GET /api/executive/summary` — 403 for non-owner roles

## Product modules (v1.0)

- [x] M6: `GET /api/catalog/services` + `POST /api/catalog/sync` seed cache; `/admin/catalog` Nafta import + package/paid filters
- [x] M5: `POST /api/lab-orders/:id/results` with out-of-range value → `CRITICAL` flag; `/lab-orders?criticalOnly=true`


## v1.1 - M10-M13 (DONE)

- [x] M10: visit CPOE fields on visit card
- [x] M11: POST /api/lab/import + `/admin/lis-profiles` CSV import UI (`POST /api/lab-orders/import`)
- [x] M12: insurance eligibility proxy (Finance)
- [x] M13: inpatient ward UI — see steps below

## M13 — Inpatient ward UI

1. Sign in as clinic staff (`/login`, seed user with `CLINIC_ADMIN` or ops role).
2. Enable **`inpatient_day`** in **Admin → Settings** if nav link hidden.
3. Configure wards in **Admin → Wards & beds** (`/admin/wards`).
4. Open **`/inpatient`** — ward tiles show occupied/free; expand ward for bed actions; **`/inpatient/census`** grid for transfer/discharge.
5. API smoke (optional): `GET /api/inpatient?view=census`; `POST /api/inpatient` `{ action: "admit", bedId, patientRefId }`; `POST /api/cron/inpatient-daily-charges` with cron Bearer token.

## Presets + MDM (P1)

1. **Admin → Settings** — toggle product lines; disabled routes redirect from `/sanatorium` / `/inpatient`.
2. **Patients** — FIN + MDM lookup; masked `globalPersonId` badge on list.
3. **Appointments** — Cancel visit from selected appointment panel (K-15).

## Admin master data (2026-06-15) — UI paths (no curl)

Prerequisite: `chingiz@era.com` / bootstrap password, `CLINIC_ADMIN`; after `docker compose up clinic` seed runs (`RUN_SEED=true`).

1. **`/admin/master-data`** — add practitioner: FIN or passport+country required; MDM lookup; edit loads identifier types from MDM (re-enter to change). No plaintext FIN/passport on practitioner row.
2. **`/admin/wards`** — create/edit/delete ward and bed via modals.
3. **`/patients`** — filter bar (sex, blood, MDM, age) + paginated grid; **Open card** modal; anamnesis required on demographics edit. **`/patients/[id]`** deep link still works via shared `PatientCardBody`.
4. **`/appointments`** — practitioner day matrix; click free cell → **New appointment** modal (prefilled); occupied → check-in / cancel; DnD reschedule.
5. **`/lab-orders`** — **New lab order** modal from patient list.
6. **`/visits/[id]`** — complete confirm modal; issue prescription modal; discount modal.
7. **Home `/`** (owner) — executive KPI block on top; filter by date and practitioner.
8. **`/cashier`** — open shift; **To pay** table (filters date/patient/origin/channel); row opens settle modal (unified lines: visit + lab + procedures). Channel actions: local pay (split CASH/CARD), folio charge, or send to hub. Mock fiscal badge on local. Deep link `/cashier?visitId=` opens modal.
9. **`/cashier` History** — reprint; VOID local PAID receipt with reason.
10. **`/cashier` Over-quota** — see sanatorium over-quota / folio logs; **Collect locally** for standalone `LOCAL` rows.
11. **Settlement hub:** walk-in with hub policy → channel `SETTLEMENT_HUB` in queue (not a hard UI block); hotel `/front-cash/pending` after settle.

## Sanatorium clinical day

Prerequisite: preset `sanatorium_clinical`; hotel guest with medical rate plan checked in; `programSchedulingMode=AFTER_CHECKUP`.

1. **`/sanatorium`** — episode visible; **no** procedures until checkup (complaint + ICD). Search ICD (`I10` / гипертенз) → add diagnosis → then schedule program.
2. **Complete checkup & schedule program** → FIFO chart with 5-min slots; same procedure not twice same day. Slots require free **cabin/equipment** AND **skilled HARD staff** (Pattern A allocations).
3. **`/nurse`** — day board: agenda (previous slot → EOD) + day progress; kanban Missed / Upcoming / In progress / Completed. **Check-in** only while unified window open (`endsAt`, +gap if next slot free) → `CHECKED_IN`. No nurse No-show button. Missed rows stay `SCHEDULED` until EOD sweep. Late guests: reception reschedules.
4. **`/sanatorium/resources`** — reception **Location day board**: Asia/Baku clocks; lunch 13–14 shown as muted (not bookable); date + resource/patient filters + horizon (+1h/+3h); per-type `resourceGapMinutes` / `patientRestMinutes` on procedure types (tenant default = create default only); DEMO-WEEK from Randevular (~840 orders). Drag/move/cancel as before.
5. Dispute path: audit on ProcedureOrder (`checkedInAt/By`, `checkInChannel`, `completedAt/By`, `noShowAt/By`).
5. Reschedule procedure time on chart → conflict rules enforced (cabin + staff).
6. Walk-in **Register walk-in** → program instantiate → billing per settlement hub or cashier.
7. Early hotel check-out → future procedures **CANCELLED** (lifecycle consumer).
8. **`/admin/master-data`** — practitioner **skills** (procedure types); procedure type **requirements** on **Add and Edit** (resource dropdown + STAFF HARD/SOFT); single Save; optional catalog code pick on create; resource ↔ room link. Opening the list backfills missing requirements (SVC-* get SOFT staff by default).
9. **`/admin/catalog`** — Import Nafta prices; filter package vs paid; department column.
10. **SOFT staff** — with STAFF=SOFT, planner/available-slots/reschedule do **not** require exclusive nurse time; multi-capacity resources (e.g. ozone capacity=3) can fill while nurses are shared.
11. **`/sanatorium/nurse-roster`** (DOCTOR / SatAdmin) — pick month; assign nurses to procedure rows; mark stable; add vacation overlapping the month → warning on the row; **Approve**. Confirm a proposed program: STAFF allocation should be the posted nurse (unless they are absent that day). Master-data practitioners show Doctor / Nurse / Lab.

### ICD-10 catalog (CLI-39…42)

1. **`/sanatorium`** — search ICD picker for `I10` or «гипертенз»; add diagnosis (selectable category/leaf only) + optional note; then **Complete checkup & schedule program**. Chapter/BLOCK codes must not save.
2. **Patient card** (`/patients/[id]` or sanatorium patient modal) — contraindications body map is **collapsed** (amber bar + expand); ICD-10 list sits **below** it; add/remove against the **open** episode. Without an open episode the add path is hidden (409 `NO_OPEN_EPISODE` if posted).
3. **`/visits/[id]`** — add primary/secondary visit diagnoses; list updates.
4. **`/inpatient`** — admission diagnoses modal (admission/discharge + role).
5. **Print checkup** — patient print form shows recorded diagnoses.
6. **`/reports/diagnoses`** (DOCTOR) — date range + source/chapter; table totals episode/visit/admission.
7. **`/admin/icd-favorites`** — pin a favorite; Sync catalog; retire a code (`active=false`); titles are not editable.



### Diagnostic catalog DB + lab registry (CLI-32)

1. **/admin/diagnostic-catalog** — create/edit modality and service; analytes for a lab panel; list refreshes. **Favorites tab** — pin modalities/categories, choose first/only, Save; picker order on `/lab-orders` reflects it. (`/admin/catalog-favorites` route removed.)
2. **/lab-orders** — table with modality/patient/date filters + pagination; Complete only on PUBLISHED.
3. **/lab-orders/[id]** — enter results → RESULT_READY; edit while RESULT_READY; after Publish results are read-only; Print stub shows coming soon.

### Doctor-confirmed FIFO planning (CLI-31)

1. **Patient card confirm proposed** — open `/patients/[id]` after program instantiate; proposed procedures listed; **Confirm selected** / **Confirm all** → orders become `SCHEDULED` on `/sanatorium/resources` matrix (not before confirm).
2. **Bulk cancel + replace** — on `/sanatorium` course detail, select procedures → **Bulk cancel** with reason and optional replace code → cancelled lines + replacement proposed/scheduled as configured.
3. **External lab >90d blocked** — create lab order with external result date older than 90 days → UI/API rejects with clear error (not accepted).
4. **Peak mode settings** — `/admin/settings` enable peak mode; modalities with `extendedEndHour` (laser/infrared/darsonval/sollyuks/ultrafonophoresis) may book past day end; disable peak → those slots blocked again.

### Design tokens visual (Wave C)

1. **/admin/settings** + **/admin/procedure-rules** — Field*/kit buttons; no raw hex chrome; save works.
2. **/patients/[id]** — proposed confirm + body-part selects use Field*; muted/danger text via kit classes.
3. **/nurse** + **/sanatorium** — agenda/matrix layout unchanged; primary/success/danger/muted match DESIGN.md via kit tokens.
4. **/lab-orders** create (external) — DatePicker + FieldSelect; no native date-only chrome.

### Pattern B outpatient (practitioner matrix)

1. **`/appointments`** — rows = doctors; click free slot to book; DnD to move (optional other practitioner row).
2. Create/reschedule with `resourceId` still 409 if resource booked (API).

Coverage: [COVERAGE_MATRIX.md](../../docs/COVERAGE_MATRIX.md) CLI-*.

## Platform catalog gateway (Wave 2)

Prerequisite: orchestrator `:4000` + data-hub `:4200`; `SATELLITE_EVENT_SERVICE_TOKEN` + `ERA_SATELLITE_ORGANIZATION_ID` on clinic container.

1. **`/appointments`** — pick a known non-working day (public holiday in hub seed); new appointment on that date is blocked or warned per clinic rules.
2. Follow-up date suggestion respects business-day calendar (orchestrator `/platform/v1/catalog/calendar/az/add-business-days` via satellite-kit).

## Workforce single path (Wave 3 / Plan C)

### Smoke — CP workforce hire (`cp_workforce`)

Prerequisite: org with `platform_workforce` + `industry_clinic`; orchestrator fan-out + clinic running.

1. Orchestrator → **`/workspace/workforce/security`** → confirm Therapist → clinic **DOCTOR** in role matrix (or seed via `scripts/nafta-onboard-departments.mjs`).
2. **`/workspace/workforce/employments`** → hire MDM person → Med Block → Therapist → **Clinic** checkbox → submit.
3. Clinic **`/admin/master-data`** — **Add practitioner** hidden; banner points to CP Workforce; edit specialty/slots only.
4. Local login as provisioned ops user → `/appointments` accessible per role.
5. (Optional) Security Admin manual grant **CLINIC_ADMIN** → admin routes; revoke → admin blocked, doctor OK.



## Print forms (CLI-34)

1. Admin -> Settings -> Print branding: set AZ clinic name + phone; save.
2. Lab order workflow -> Print -> choose language -> form opens and print dialog appears.
3. Patient card -> Print check-up / Print schedule -> language dialog -> print page.
4. Qualitative analyte (if configured): enter via select; reprint in another language shows translated label.

## Topology — two-org isolation (CP-TENANT-01 / Wave 10)

**Status:** outline only — field run **pending**. Does **not** unlock AC-CLI-TENANT Scaffold ✅, SHIPPED, or SHARED pool sell. Signoff stub: [`reports/two-org-isolation-signoff.md`](../../reports/two-org-isolation-signoff.md).

### Prerequisites

- Clinic schema with `organizationId` on tenant roots + kit Prisma tenant extension.
- Two distinct org UUIDs (`ORG_A`, `ORG_B`) bound via Sync / `ERA_SATELLITE_ORGANIZATION_ID` for dedicated deploys; for a shared DB lab, run one process with ALS/bind switching **or** two sequential binds with clear data ownership.
- Super-admin + clinic ops login.

### API outline

1. Bind clinic to `ORG_A`; create patient / appointment (or use seed) tagged to `ORG_A`.
2. Switch bind (or second process) to `ORG_B`; `GET /api/patients` (and appointments list) must **not** return `ORG_A` rows.
3. Attempt cross-org update by id from `ORG_B` session → expect 404 / empty (not other org’s data).
4. Negative: raw SQL / admin without filter is out of scope — product path must use kit filter.

### UI outline

1. Ops login → `/patients` as `ORG_A` — list shows only A.
2. After org switch / second appliance → `/patients` shows only B; no A names/phones.
3. Record pass/fail in `reports/two-org-isolation-signoff.md` (do not mark passed until field run).

## Deny (Scaffold BE negative paths)

1. **Module off → 403:** With `industry_clinic` inactive (or unbound org / source=fallback), operational routes that call `assertClinicEntitled` / `getRouteSession` return **403** (`Industry module not active: industry_clinic`). Proof: `__tests__/cli-*-negative.spec.ts`.
2. **OPS:** Cancel COMPLETED appointment refused; double-book / off-shift → 409; reschedule on CANCELLED/COMPLETED denied.
3. **PT / MD:** Patient without FIN/passport/MDM identifier refused; inactive practitioner not bookable.
4. **SAN:** Doctor-confirm skipping earlier PROPOSED → **409** FIFO.
5. **LAB (ops):** Illegal publish/collect/complete status paths refused — **not** live HL7 (CLI-23 External).
6. **CASH:** Settle deny when visit missing / shift closed; live fiscal KKM refused — **not** NBC live (CLI-24 External).
7. **PRINT / CAP:** Missing print source / unsupported lang; critical capacity blocks medical-package booking.

## Procedure TTK → Finance (CLI-47)

**Status:** API landed (W1+W2). Sign-off required before SHIPPED. ADR: [clinic-procedure-consumable-ttk.md](../../docs/adr/clinic-procedure-consumable-ttk.md).

1. SatAdmin → `/admin/master-data` → Procedure types → edit type → **Procedure TTK**: search Finance product, set qty per session, save.
2. Empty BOM: complete a procedure → event `lines=[]`; Finance shows no stock movement for that order id.
3. With BOM: nurse check-in → wait/auto-complete (or complete) → Finance `/inventory` stock OUT for those SKUs (corr = procedure order id). Shortage does **not** block nurse (warn+post).
4. Replay same correlationId → Finance idempotent skip (no double write-off).
5. Out of this UAT: retail pharmacy, Rx reserve, guest folio line per pad.

