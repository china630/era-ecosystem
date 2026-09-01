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
7. **`/lab-orders`** — DATA_TABLE list (services Name (CODE) / patient / modality / status / amount / date=`collectedAt`), filter bar order: **patient free-text (q)** → status → modality → date from/to; critical only; `ListPaginationFooter`. Delete (trash) only while `ORDERED`. Create: OPEN duplicate → message + no create; COMPLETED duplicate → Yes/No repeat (`confirmRepeat`). Row opens workflow modal.
8. **`/lab-orders/[id]`** / workflow modal — title `Name (CODE) — patient`; structural results table; cancel if ORDERED; results re-editable while `RESULT_READY` (before publish); read-only once `PUBLISHED`/`COMPLETED`; Print lab **and** USM use Name (CODE); step chips show role hint

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
3. **`/patients`** — identity registry (full base, `episodeStatus=ALL`): filter bar sex (no Other) / blood / age min·max inclusive ≥/≤ / MDM filter·column **only platform Super-Admin**; grid shows clinic-native **`P-######`**, sex **K/Q**, thin **Open course** badge (no room/package/check-in columns); one server paginator. **Register patient**: Ad / Soyad / Ata adı; nationality empty default; sex M/F/unknown only. **Open card** modal — identity + episode selector; contraindications title **inside** amber box; complaints `+ Şikayət` / ICD `+ Diaqnoz` outside cards; results print **per row only** (no header checkup print); intake checklist has **no** block print; **Klinik tarixçə** — type (All / Appointments / Visits / Exams / Labs) + period default 30d; compact cards + print. Course room/program ops live on **`/sanatorium`**. **`/patients/[id]`** via shared `PatientCardBody`.
4. **`/appointments`** — practitioner day matrix; click free cell → **New appointment** modal (prefilled); occupied → check-in / cancel; DnD reschedule.
5. **`/lab-orders`** — **New lab order** modal from patient list.
6. **`/visits/[id]`** — complete confirm modal; issue prescription modal; discount modal.
7. **Home `/`** (owner) — executive KPI block on top; filter by date and practitioner.
8. **`/cashier`** — open shift; **To pay** table (filters date/patient/origin/channel); row opens settle modal (unified lines: visit + lab + procedures). Channel actions: local pay (split CASH/CARD), folio charge, or send to hub. Mock fiscal badge on local. Deep link `/cashier?visitId=` opens modal.
9. **`/cashier` History** — reprint; VOID local PAID receipt with reason.
10. **`/cashier` Over-quota** — see sanatorium over-quota / folio logs; **Collect locally** for standalone `LOCAL` rows.
11. **Settlement hub:** walk-in with hub policy → channel `SETTLEMENT_HUB` in queue (not a hard UI block); hotel `/front-cash/pending` after settle.

## Workforce local login (CLI-WF-01 / CLI-WF-PWD-01)

1. CP Workforce grant or Reprovision for a clinic binding → clinic `/login` with `emp-{staffCode}` and PIN **`0000`**.
2. After sign-in: profile menu → **Change password** (`/account/password`). Current = `0000`, new password ≥ 8 characters. Re-login with the new password.
3. SSO owner accounts have no local password (the form returns 403).

## Sanatorium clinical day

Prerequisite: preset `sanatorium_clinical`; hotel guest with medical rate plan checked in; `programSchedulingMode=AFTER_CHECKUP`.

1. **`/sanatorium`** — open courses table with **ListPaginationFooter** (server page/pageSize; **no** page echo from API; footer stays visible while loading) + search + origin + **hotel room** + **program/package** filters; episode visible; **no** procedures until checkup (complaint + ICD). Search ICD in **one** searchable field (`I10` / гипертенз) → add diagnosis → then schedule program. Treatment chart: delete complaint/diagnosis rows; delete lab only if ORDERED; adding a duplicate COMPLETED lab shows Yes/No repeat confirm. Quota bars show **Name (CODE)** not raw `WO-TR-*`. **Register walk-in**: Ad / Soyad / Ata adı; nationality SEARCHABLE empty (not AZ); FIN or passport required; allocates `P-######`.
2. **Complete checkup & schedule program** → FIFO chart with 5-min slots; same procedure not twice same day. Slots require free **cabin/equipment** AND **skilled HARD staff** (Pattern A allocations).
3. **`/nurse`** — day board: agenda (previous slot → EOD) + day progress; kanban Missed / Upcoming / In progress / Completed. **Check-in** only while unified window open (`endsAt`, +gap if next slot free) → `CHECKED_IN`. No nurse No-show button. Missed rows stay `SCHEDULED` until EOD sweep. Late guests: reception reschedules.
4. **`/sanatorium/resources`** — reception **Location day board**: Asia/Baku clocks; lunch 13–14 shown as muted (not bookable); date + resource/patient filters + horizon (+1h/+3h); per-type `resourceGapMinutes` / `patientRestMinutes` on procedure types (tenant default = create default only); DEMO-WEEK from Randevular (~840 orders). Drag/move/cancel as before.
5. Dispute path: audit on ProcedureOrder (`checkedInAt/By`, `checkInChannel`, `completedAt/By`, `noShowAt/By`).
5. Reschedule procedure time on chart → conflict rules enforced (cabin + staff).
6. Walk-in **Register walk-in** → program instantiate → billing per settlement hub or cashier.
7. Early hotel check-out → future procedures **CANCELLED** (lifecycle consumer).
8. Hotel stay product change from date (`SATELLITE_HOTEL_STAY_PRODUCT_CHANGED`) → remaining **PROPOSED** and **SCHEDULED** orders from the effective date are cancelled; completed/checked-in stay. Clinic rebuilds a new **PROPOSED** plan for the new program when a matching template exists.
9. **`/admin/master-data`** — practitioner **skills** (procedure types); procedure type **requirements** on **Add and Edit** (resource dropdown + STAFF HARD/SOFT); single Save; optional catalog code pick on create; resource ↔ room link. Opening the list backfills missing requirements (SVC-* get SOFT staff by default).
10. **`/admin/catalog`** — Import Nafta prices; filter package vs paid; department column.
11. **SOFT staff** — with STAFF=SOFT, planner/available-slots/reschedule do **not** require exclusive nurse time; multi-capacity resources (e.g. ozone capacity=3) can fill while nurses are shared.
12. **`/sanatorium/nurse-roster`** (DOCTOR / SatAdmin) — pick month; assign nurses to procedure rows (**`SVC-*` names, no leftover `WO-TR-*`**); mark stable; add vacation overlapping the month → warning on the row; **Approve**. Confirm a proposed program: STAFF allocation should be the posted nurse (unless they are absent that day). Master-data practitioners show Doctor / Nurse / Lab. Procedure table has pagination footer.

### ICD-10 catalog (CLI-39…42)

1. **`/sanatorium`** — single ICD searchable picker for `I10` or «гипертенз»; add diagnosis (selectable category/leaf only) + optional note; delete diagnosis from chart; then **Complete checkup & schedule program**. Chapter/BLOCK codes must not save. Empty chapter list must not block search (catalog must be seeded: `node prisma/load-icd10.cjs`).
2. **Patient card** (`/patients/[id]` or sanatorium patient modal) — contraindications body map **collapsed** (title + expand **inside** amber box); ICD-10 list below with `+ Diaqnoz` on the header row; complaints `+ Şikayət`; add/remove against the **open** episode. Without an open episode the add path is hidden (409 `NO_OPEN_EPISODE` if posted).
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

## Role access matrix (CLI-RBAC-01 / Variant A)

1. Sign in as **CLINIC_ADMIN** → **`/admin/access`** opens; matrix lists roles and permission groups.
2. Save or Reset → session refresh toast; **this** admin session JWT updates without re-login. Other logged-in users still need re-login for **page** middleware.
3. **RECEPTION** role — uncheck `screen:sanatorium.nurse_roster`, save; re-login as reception user → nurse roster nav hidden and `/sanatorium/nurse-roster` redirects forbidden.
4. **DOCTOR** role — uncheck `screen:sanatorium.resources`, save; re-login as doctor → resource matrix hidden; sanatorium list still visible if `screen:sanatorium` checked.
5. **Reset to defaults** on RECEPTION → sanatorium split matches seed (reception: resources yes, nurse roster no).
6. `PATCH /api/admin/roles/RECEPTION/permissions` without `admin:access_manage` → 403 for non-admin ops roles.
7. Without `api:sanatorium.episodes.read`, `GET /api/sanatorium/episodes` and `GET /api/sanatorium/episodes/[id]` return **403** (API uses DB, not stale JWT). Without `api:procedures.reception`, `POST /api/procedures` returns **403**.
8. **Wave 2 — CLINIC_ADMIN matrix:** uncheck `screen:admin.catalog` for **CLINIC_ADMIN**, Save (session refresh). Catalog nav item hidden; `/admin/catalog` forbidden after refresh; `GET /api/admin/catalog` returns **403**. Re-check + Save → access restored. OrgOwner SSO still sees all admin screens.
9. **Wave 3 — staff APIs:** uncheck `screen:patients` / `api:patients` for RECEPTION → patients nav hidden; `GET /api/patients` **403**. Uncheck `api:appointments.write` → `POST /api/appointments` **403** (session required). Queue/lab/confirm similarly gated by matrix.
10. **Gap closeout:** role without `api:catalog.read` → `GET /api/imaging-phrases` **403**. Without `api:lab_orders` → `POST /api/lab/import` **403**. Without `screen:admin.templates` → `/api/templates` **403**. After upgrade, customized matrices: **Reset to defaults** (or grant new keys) so Wave 3 api:* keys appear.



## Print forms (CLI-34)

1. Admin -> Settings -> Print branding: set AZ clinic name + phone; save.
2. Lab order workflow -> Print -> choose language -> form opens and print dialog appears.
3. Patient card -> Results **per-row** print (lab/USM) and Plan **Print schedule** → language dialog → print page. Check-up form remains at `/print/checkup/...` (no header button on Results/intake).
4. Qualitative analyte (if configured): enter via select; reprint in another language shows translated label.

## Extra tickets (Nafta dual-run, HOT-06)

**Lab (Wave 6):** CI `saas-wave6-hot06-lab` (clinic + hotel) + Super-Admin policy / Issue-ticket UI path — see [`reports/hot06-lab-signoff.md`](../../reports/hot06-lab-signoff.md). Lab unlocks **SHOW** for Super-Admin policy + this Issue-ticket screen. Extension SPA Insert stays **HEADLESS** / field-open. **Not SHIPPED**.

**Field runbook:** [`reports/hot06-field-runbook.md`](../../reports/hot06-field-runbook.md) — do not mark HOT-06 SHIPPED until field checklist is pass.

Prerequisite (ops): clinic cutover policy `elektrawebDualRun` + Sync; hotel org `writeEnabled` + Sync; pool kill switch; extension on **sanatorium** desk with Write ON and SPA open.

1. Doctor assigns a paid extra (or over-quota).
2. **`/reception/extra-tickets`** — select rows → **Issue ticket**. ERA opens 3-copy print (`/print/extra-ticket/…`). Charge is **not** posted on nurse complete.
3. Confirm hotel health `writeEnabled` and outbox not stuck `FAILED`. Unknown SPA product must fail enqueue (do not guess).
4. **`/nurse`** — extra without ticket → check-in blocked (`TICKET_REQUIRED`).
5. Walk-in extra lands on Elektraweb **Tibbi Ambulator** house folio, not clinic cashier (field).

```bash
cd era-clinic && npm test -- --testPathPattern=saas-wave6-hot06-lab
cd era-hotel-pms && npm test -- --testPathPattern=saas-wave6-hot06-lab
```

## Topology — two-org isolation (CP-TENANT-01 / SaaS Waves 5 + 9)

**Status:** **Lab** CI + **Live pool smoke** (opt-in); **Field** still **pending**. Does **not** unlock AC-CLI-TENANT Scaffold ✅, SHIPPED, or SHARED pool sell. Signoff: [`reports/two-org-isolation-signoff.md`](../../reports/two-org-isolation-signoff.md).

### Lab (CI)

```bash
cd era-clinic && npm test -- --testPathPattern=saas-wave5-two-org-isolation
```

Suite: `__tests__/saas-wave5-two-org-isolation.spec.ts` — real kit `mergeWhere` / ALS: Org B list excludes Org A patients/appointments; cross-org get-by-id empty; ALS stamp wins over process bind.

### Live pool smoke (Wave 9, opt-in)

One DB + Prisma tenant extension. Skip (exit 0) unless `ERA_WAVE9_POOL_SMOKE=1`.

```bash
cd era-clinic
# DATABASE_URL = migrated clinic DB
set ERA_WAVE9_POOL_SMOKE=1
node scripts/saas-wave9-two-org-pool-smoke.mjs
```

Record result in signoff **Live pool smoke** section. Live smoke ≠ field; still not Scaffold ✅.

### Field (pending)

### Prerequisites

- Clinic schema with `organizationId` on tenant roots + kit Prisma tenant extension.
- Two distinct org UUIDs (`ORG_A`, `ORG_B`) in one SHARED-ready DB (or sequential appliance binds with clear data ownership).
- Super-admin + clinic ops login with JWT/`organizationId` (Wave 2 request tenant).

### API outline

1. Login / bind as `ORG_A`; create patient / appointment tagged to `ORG_A`.
2. Session as `ORG_B`; `GET /api/patients` (and appointments list) must **not** return `ORG_A` rows.
3. Attempt cross-org update by id from `ORG_B` session → expect 404 / empty (not other org’s data).
4. Negative: raw SQL / admin without filter is out of scope — product path must use kit filter.

### UI outline

1. Ops login → `/patients` as `ORG_A` — list shows only A.
2. After org switch / second appliance → `/patients` shows only B; no A names/phones.
3. Record pass/fail in `reports/two-org-isolation-signoff.md` (field section — do not mark Scaffold ✅ from lab alone).

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

## Nafta cutover import

**Nafta card wave (2026-08-30) — after deploy:** seed diagnostic + physio catalogs → re-Apply `#23` → optionally `#31` (skip `#32`/`#33`/`#34` for intake). See `NAFTA-CUTOVER-IMPORT.md` § Post-deploy.

1. Dry-run 01–04 in `/admin/import` (preview row counts, no writes). `#26` slots: select all files from `clinic/26-Slots/` (`26-Slots-p01.xlsx` …), not a single full book. Confirm `/api/import` keeps the session cookie (multipart Apply must not 401).
2. **/patients**: identity filters only; open-course badge; hotel room + program filters are on `/sanatorium`. After overlay + Re-Apply `#24`, agency/Həmkarlar (incl. September Reservation) and Extra/Res/CIn/Operator/Payment phrases show in **Proqram / paket** on the sanatorium board.
3. Confirm historical COMPLETED slots do not create folio lines or nurse bonus.
4. After catalog seed + Apply `#31` (skip `#32`): patient **2019** shows **three** USG rows (`USG-BREAST` / `USG-THYROID` / `USG-ABD`) with organ fields plus original Qeyd (`sourceNote`). `/lab-orders` date is clinical day (`collectedAt`), not Apply time.
5. Intake checklist (not WO CheckUp `#33`): patient card **2152** / **2019** show section **İlkin diaqnostik prosedurlar** with four rows (`SANATORIUM-INTAKE`, `GYN-OR-URO`, `ECG-12`, `USG-ABD`). After `#31`, USM row is DONE/ORDERED (not MISSING). Check-up print form remains at `/print/checkup/...` (not linked from intake header).
6. Live check-in (hotel stay / walk-in): open episode → ECG-12 + USG-ABD appear as ORDERED if missing; second open does not duplicate; physio FIFO still requires complete-checkup / program path (not auto from intake).
7. After re-Apply `#23` (Baku `+04:00` slot parse): Yağmur — two Solyuks times both visible; compact PLAN date+time matches modal for the same `procedure:{id}`; **Növbəti** is nearest `scheduledAt >= now` in Baku (not a 2024 leftover). No 18:36↔10:36 jump after re-import.

## CLI-49 — Physio sites (W2–W4)

SatAdmin:

1. Sign in as `CLINIC_ADMIN`. Open **Catalogs → Physio sites** (`/admin/physio-sites`).
2. Tabs **Sites / Programs / Substances** list seeded rows (after `npm run db:seed:physio` = base + Nafta overlay).
3. Open a site: titles az/ru/en/la, kind Select, coarse MULTI, aliases textarea. Save.
4. Add a substance. Retire it (row stays, picker drops it).
5. `/admin/master-data` → Procedure types → Amplipuls: **Needs site chips** on; order fields include work-kind + electrodes. Ozone: chips off.
6. Tab **Unmatched**: after a slots import with leftover nahiye, a row shows sample + residue. Pick an existing S (`CatalogField` SEARCHABLE) → **Add as alias**. Confirm it does **not** create a new S. Mark a non-anatomy leftover **Not anatomy**. Re-open the same string — status stays resolved (hit count may rise).

Doctor card (no curl):

7. Open a patient with **Proposed plan**. Chips + autocomplete add two S (locale title + Latin on the chip).
8. With ≥2 sites, **Together / In turn** chips appear; pick In turn (`növbəli`).
9. Type a comment in **Note**; it stays after reload. Confirm the line — sites remain on the scheduled plan.
10. Ozone / inhalation: **Note** still shows; site chips hide (`needsSite=false`). Amplipuls shows work-kind I–V + electrode 2/4, not a substance picker.
11. On a laterality-enabled S (knee/shoulder), pick Left/Right/Both. A type without LATERALITY does not show side chips.
12. After cutover `#23` import (seed physio catalog **first**): Solyuks with `Belinə` / `Başına` shows lumbosacral / head chips; naftalan `Tam` shows full-body chip (+ fill `TAM` when gated). **Note** keeps unmatched residue only (not a duplicate of resolved S tokens). Empty catalog UI says catalog not seeded — not «No matches».
13. Compact PLAN on the card lists site chip titles (or «sites — open full plan» when none). BODY_PART contraindications map is **not** the zone picker.

## Medical package assign without hotel SKU (CLI-50 / Wave A)

**Status:** Engineering SCREEN — not SHIPPED.

1. Hotel check-in without resolved `programCode` → `/sanatorium` shows OPEN episode (patient not dropped).
2. **Complete checkup** → Select one of `PKG-STANDART` / `PKG-PREMIUM` / `PKG-DERMO` / `PKG-DETOKS` (empty allowed until submit; ICD/complaint still required).
3. Walk-in registration uses the same four-code Select.
4. Open `/sanatorium?episode=<id>` → treatment chart modal opens (not only PatientCard).
5. Patient card «Gün planını aç» href lands on that deep link.

## Program quota knots (CLI-51 / Wave B)

**Status:** Engineering API — not SHIPPED.

1. `/admin/templates` program tab — edit multi-procedure JSON + knots JSON; Save keeps all lines.
2. Instantiate Standart 12 nights → bath quota 9; Premium 13 nights interpolates.
3. Extend/shorten stay from hotel → clinic recalc totals; SCHEDULED procedures remain.
4. Standart→Premium: used baths count against new total; no SCHEDULED cancel.
5. In-quota procedure charge = 0 AZN; over-quota = list price; walk-in without package paid.

## Doctor first-day confirm (CLI-52 / Wave C)

**Status:** Engineering SCREEN — not SHIPPED.

1. After checkup, proposed list sorted with exam/intake first; default checkbox first 2–3.
2. **Confirm selected** only — **Confirm all** removed on `/sanatorium` and patient card.
3. Confirming a later ID while earlier PROPOSED exists still 409 (FIFO unchanged).
4. `/admin/settings` shows Program scheduling mode; Nafta stays **AFTER_CHECKUP** (do not enable ON_CHECKIN for Nafta).
5. Fourth same-day in-package procedure → list price; does not burn remaining knot.
6. Soft warn (not hard-block) if confirm batch >3 procedures.
7. Manual `POST /api/procedures` for in-quota package codes stays PROPOSED / 409 — nurse cannot SCHEDULE without doctor confirm.

## Doctor bonus extras (CLI-53 / Wave D)

**Status:** Engineering SCREEN — not SHIPPED.

1. Package-only day (all in-quota COMPLETED, amountNet 0) → doctor-bonus view **0** (bonusEligible false).
2. Over-quota / walk-in extra / 4th same-day paid → appears in IN_HOUSE or WALK_IN bucket.
3. `/admin/settings` doctor bonus % defaults **0**; report shows base AZN × % columns when set. FO must supply % before pilot — engineering does not invent (see `reports/nafta-pkg-pilot-punch.md`).
4. Confirming PROPOSED package lines does not add those lines to bonus.
5. PATCH doctorBonusPercentInHouse / WalkIn works; i18n en/az/ru present.

## One stay two episodes (CLI-54 / Wave E)

**Status:** Engineering SCREEN — not SHIPPED.

1. Mix card (Premium + Standart) → two `/sanatorium` rows, same room; two PatientRef / ProgramInstance.
2. Extra charge on wife does **not** burn husband’s quota.
3. Checkout closes both OPEN episodes.
4. Same-SKU couple (both Standart) still two charts.
5. Share rooms remain two reservations (regression).

## Episode as care course (CLI-55) — SCREEN

**Status:** SCREEN (waves W1–W4 landed). Keep SCREEN until field punch — do not claim SHIPPED / SHOW / Pilot.

ADR: [clinic-episode-as-clinical-course.md](../../docs/adr/clinic-episode-as-clinical-course.md).

1. Patient card — episode CatalogField (default latest); anamnesis above CI → ICD → clinical blocks; CLOSED = read-only.
2. Empty OPEN anamnesis → confirm procedures disabled / API `409 ANAMNESIS_REQUIRED`; demographics save works without anamnesis.
3. Second OPEN walk-in for same patient → `409 WALK_IN_OPEN_EXISTS`.
4. `/sanatorium` Close on idle WALK_IN; refuse when live procedures or open labs remain (no silent cancel).
5. Returning guest intake creates ECG/USG on the **new** episode (does not skip last year’s labs).
6. Print checkup/procedures with `?episode=` for a past course does not mix the new stay.

