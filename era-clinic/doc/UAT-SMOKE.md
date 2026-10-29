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
- [x] **Clock:** queue ticket numbering, appointments/sanatorium calendar defaults, executive summary, and EOD no-show sweep use **Asia/Baku** day bounds (`bakuDayBounds` / `parseBakuDateTime`) — not host `setHours(0)` / UTC slice. After 20:00Z previous UTC day = still current Baku calendar day until 20:00Z.
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
- [ ] **Mutation audit Layer A (CLI-19 belt — open):** after any successful admin mutation, open `/admin/audit` (`GET /api/admin/audit`) → filter **HTTP mutations (Layer A)** (+ entityId / action / user / dates) → row shows method + path; ProcedureOrder / Visit still show Layer B; **Cashier receipt** SETTLE/VOID and **Cashier shift** OPEN/CLOSE filter after a settle or Z-close. Login must not appear.
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

Prerequisite: `shirinov.chingiz@gmail.com` / bootstrap password, `CLINIC_ADMIN`. Droplet / compose: `CLINIC_RUN_SEED` / `RUN_SEED` stays **false** (ADR clinic-catalog-template-overlay). Do **not** run full `npm run db:seed` after cutover. Local empty DB: `npm run db:seed` (ICD + satellite templates only) then Sync/bind so copy-if-empty fills the org; kitchen-sink demo = `npm run db:seed:demo` only.

1. **`/admin/master-data`** — practitioner card: name, staff kind, skills as a scrolling list. FIN or passport+country (country is a list) only when the person is not linked; a linked card shows “linked” and Change. No specialty field and no personal slot. No plaintext FIN/passport on the practitioner row.
2. **`/admin/wards`** — create/edit/delete ward and bed via modals.
3. **`/patients`** — identity registry (full base, `episodeStatus=ALL`): filter bar sex (no Other) / blood / age min·max inclusive ≥/≤ / MDM filter·column **only platform Super-Admin**; grid shows clinic-native **`P-######`**, sex **K/Q**, thin **Open course** badge (no room/package/check-in columns); one server paginator. **MDM soft fill on list load:** only rows on the current page with `globalPersonId` **and** a hole (sex UNKNOWN / no DOB / missing Ad or Soyad) get one `ops-profile/batch`; reception-filled fields are never overwritten (fill-not-clear). **Register patient**: Ad / Ata adı / Soyad (`firstName` / `middleName` / `lastName`); save composes `fullName`; nationality empty default; sex M/F/unknown only; **FIN or passport+country required** (phone alone rejected). Re-save without middle name → MDM fill-not-clear. **Open card** modal — identity + episode selector; contraindications title **inside** amber box; complaints `+ Şikayət` / ICD `+ Diaqnoz` outside cards; results print **per row only** (no header checkup print); intake checklist has **no** block print; **Klinik tarixçə** — type (All / Appointments / Visits / Exams / Labs) + period default 30d; compact cards + print. Course room/program ops live on **`/sanatorium`**. **`/patients/[id]`** via shared `PatientCardBody`.
4. **`/appointments`** — practitioner day matrix uses the clinic grid step; click free cell → **New appointment** with duration (from the visit service, otherwise the clinic default); occupied → check-in / cancel; DnD reschedule keeps that duration. Grid step and default reception length are on `/admin/settings`.
5. **`/lab-orders`** — **New lab order** modal from patient list.
6. **`/visits/[id]`** — complete confirm modal; issue prescription modal; discount modal.
7. **Home `/`** (owner) — executive KPI block on top; filter by date and practitioner.
8. **`/cashier`** — open shift (optional KKM / bank POS when catalog synced); **To pay** table (filters date/patient/origin/channel); row opens settle modal (unified lines: visit + lab + procedures). Channel actions: local pay (split CASH/CARD), folio charge, or send to hub. Local pay uses `@era/fiscal` (empty catalog = recorded_no_device; mock driver when a KKM row exists). Deep link `/cashier?visitId=` opens modal.
9. **`/cashier` History** — reprint; VOID local PAID receipt with reason.
10. **`/cashier` Over-quota** — see sanatorium over-quota / folio logs; **Collect locally** for standalone `LOCAL` rows.
11. **Settlement hub:** walk-in with hub policy → channel `SETTLEMENT_HUB` in queue (not a hard UI block); hotel `/front-cash/pending` after settle.

## Workforce local login (CLI-WF-01 / CLI-WF-PWD-01)

1. CP Workforce grant or Reprovision for a clinic binding → clinic `/login` with `emp-{staffCode}` and PIN **`0000`**.
2. **SHARED pool:** enter the 6-digit **ERA ID** (`orgNo`) on `/login` (field or `?org=104221`). Copy from Control Plane → Super-admin → Organizations or Workforce → Login & access. Do **not** paste the UUID.
3. After sign-in: profile menu → **Change password** (`/account/password`). Current = `0000`, new password ≥ 8 characters. Re-login with the new password.
4. SSO owner accounts have no local password (the form returns 403).

## Sanatorium clinical day

Prerequisite: preset `sanatorium_clinical`; hotel guest with medical rate plan checked in; `programSchedulingMode=AFTER_CHECKUP`.

1. **`/sanatorium`** — open courses table with **ListPaginationFooter** (server page/pageSize; **no** page echo from API; footer stays visible while loading) + search + origin + **hotel room** + **program/package** filters; episode visible; **no** procedures until checkup (complaint + ICD). Search ICD in **one** searchable field (`I10` / гипертенз) → add diagnosis → then schedule program. Treatment chart: delete complaint/diagnosis rows; delete lab only if ORDERED; adding a duplicate COMPLETED lab shows Yes/No repeat confirm. Quota bars show **Name (CODE)** not raw `WO-TR-*`. **Register walk-in**: Ad / Soyad / Ata adı; nationality SEARCHABLE empty (not AZ); FIN or passport required; allocates `P-######`.
2. **Complete checkup & schedule program** → FIFO chart with 5-min slots; same procedure not twice same day. Slots require free **cabin/equipment** AND **skilled HARD staff** (Pattern A allocations).
3. **`/nurse`** — four columns (Queue / In progress / Late / Done) once the board is about 1000px wide; fullscreen overlay always uses four, hides the app header and the filters, and stretches the columns to the bottom (date stays in the overlay header). No countdown line and no lifecycle paragraph above the columns. Queue holds today's slots that are still ahead, soonest first. Seated unpaid extras show a red unpaid block (no check-in) and move to Late after their deadline, same clock as overdue `SCHEDULED`. Slot times via `bakuTimeLabel` (browser TZ ignored). **Check-in** only on today, only on the queue card whose window is open (`endsAt`, +gap if next slot free) → `CHECKED_IN`; the button is absent on later queue cards and everywhere else. `NO_SHOW` stays in Late until today's `dayEndHour`; another date keeps that day's no-shows in Late. No nurse No-show button. Missed rows stay `SCHEDULED` until EOD sweep. Info icon sits under the status chip and opens the doctor order (sites, physio, note). Mine / All stays; a desk login opens **mine**. Staff filter (`GET /api/procedures/desk-staff`) is nurses, bath attendants, massage therapists, and doctors who perform a non-`VISIT-` procedure; lab techs and visit-only doctors stay out.
4. **`/sanatorium/resources`** — reception **Location day board**: Asia/Baku clocks (**UI labels** via `bakuTimeLabel` / `bakuDateTimeDisplay` — browser TZ ignored); lunch 13–14 shown as muted (not bookable); date + resource/patient filters + horizon (+1h/+3h); per-type `resourceGapMinutes` / `patientRestMinutes` on procedure types (tenant default = create default only); DEMO-WEEK from Randevular (~840 orders). Drag and modal Köçür stay on **this calendar day only** (no day chips; no Köçür/Ləğv et links on bars). A closed clinic day returns `closed: true` and an empty grid. Square click opens the order card (patient, room, code, status, interval, cabin, staff, package vs paid, quota) with modal **Check-in** when Settings → reception matrix check-in is on (Nafta default): blue when window open (same STRICT/SAME_DAY as nurse), red disabled unpaid for `PENDING_PAY`, no button after check-in/done/no-show. A new SKU past that package block's daily cap, or a day without a posted duty line, is 409, not a silent move.
5. **`/sanatorium` care-team dot** — assigning the first care doctor turns the episode dot green without reloading the list. The last care doctor cannot be removed (`LAST_CARE_DOCTOR`).
6. **`/lab-orders`** — first-column dot and status text follow pipeline status (ORDERED red, collected/in progress/result ready yellow, published/completed green, cancelled grey) and update that row after collect/publish without a full reload.
7. **Hotel folio revenue code** — `/admin/settings` field (default `23` AMBULATOR). Empty setting refuses the folio post with a clear message. Caller `RETAIL` still wins. Pending settlement-hub lines stay on the hub enum.
8. **Guest nationality** — hotel check-in, sanatorium booking, and stay-product events carry guest nationality (ISO). Clinic writes `PatientRef.nationality` only when the field is empty.
9. Dispute path: audit on ProcedureOrder (`checkedInAt/By`, `checkInChannel`, `completedAt/By`, `noShowAt/By`).
10. Reschedule procedure time on chart → conflict rules enforced (cabin + staff).
11. Walk-in **Register walk-in** → program instantiate → billing per settlement hub or cashier.
11a. **Register a group** (`/sanatorium/walk-in-parties`, CLI-61): list only; **Create group** opens a modal (name + visit date). Row click opens the party modal (no audit journal). **Add guest** / **Edit guest** / **Add service** / remove confirms are nested modals (sex + country required and empty by default; name optional → Guest N). Add service: kind empty until picked; doctor sticks for that guest; procedures use physio chips; line grid shows parameters; Eye opens patient card or line detail. **To cashier** sends one hotel pending line per service under one receipt. The hotel pending list shows one basket; Cash/Card writes one fiscal receipt. Unpaid procedures follow the extra-procedure route. Not a hotel group booking. Not SHIPPED / not SHOW.

11b. **Open attendance + SAME_DAY** (CLI-62): Admin → procedure type → enable **Open attendance** on a soft SKU. Package Saxla → plan/print shows «open attendance» at end of day (no matrix bar; plan has no reschedule/matrix DnD for unseated OPEN). Nurse check-in seats a free cabin → bar appears → auto-complete by duration; board shows open label until seated. Guest who does not arrive: no auto-NO_SHOW burn for OPEN. Settings → **SAME_DAY** (+ until date): timed row check-in any time that clinic day **only if already seated**; occupancy rebases to now; unseated FIXED refuses; after until date STRICT again. Matrix foresight line (calendar only) shows waiting/in-cabin counts; DnD of unseated OPEN refused. Not SHIPPED / not SHOW until field punch.
12. Early hotel check-out → future procedures **CANCELLED** (lifecycle consumer).
13. Hotel stay product change from date (`SATELLITE_HOTEL_STAY_PRODUCT_CHANGED`) → remaining **PROPOSED** and **SCHEDULED** orders from the effective date are cancelled; completed/checked-in stay. Clinic rebuilds a new **PROPOSED** plan for the new program when a matching template exists. The same event fills an empty patient nationality.
14. **`/admin/master-data`** — practitioner **skills** (procedure types); procedure type **requirements** on **Add and Edit** (resource dropdown + STAFF HARD/SOFT); single Save; optional catalog code pick on create; resource ↔ room link. Opening the list backfills missing requirements (SVC-* get SOFT staff by default) and drops an empty EQUIPMENT row plus a second STAFF row.
15. **`/admin/catalog`** — Import Nafta prices; filter package vs paid; department column.
16. **SOFT staff** — with STAFF=SOFT, planner/available-slots/reschedule do **not** require exclusive nurse time; multi-capacity resources (e.g. ozone capacity=3) can fill while nurses are shared.
17. **`/sanatorium/nurse-roster`** (DOCTOR / SatAdmin) — pick month; toggle **Procedures | Nurses**; assign one or more people to a procedure (doctors, nurses, bath attendants, massage therapists) or assign procedures to a person; mark stable; add vacation overlapping the month → warning on the row; **Approve**. Approve moves not-yet-started `SCHEDULED` staff in that month onto a free posted person for that procedure (time and cabin stay; a day substitute replaces the list that day; a HARD clash tries the next posted person and leaves the slot empty only when nobody is free; past and checked-in stay; the lab roster does not move these rows). Day substitute is the arrow icon on the chip. Master-data practitioners show Doctor / Nurse / Bath attendant / Massage therapist / Lab. Tables have pagination footers. ADR `clinic-staff-duty-roster.md`.
18. **Sollyuks one code** — master-data and the nurse roster show `SVC-SOLLYUKS` only. Package Saxla for Solyuks uses that type (same row as Esmira). `SVC-SOLYUKS` is gone. A miss toast names the procedure and the day; seated siblings in the same save stay. Doctor confirm on `/sanatorium` is the same: seated rows stay, unplaced stay Proposed, toast names the miss and the day.
19. **Bath Saxla without calendar** — package modal has no mini bath grid. Saxla start date/hour is the first bath: Monday 11:00 → Mon from 11:00, Tue–Wed from 09:00, rest Thursday (mode `3`). Start Tuesday 11:00 qty 4 → Tue 11:00, Wed–Thu 09:00, rest Friday, Sat 09:00. Clinic day 09:00–17:00. `/admin/settings` shows default mode `3`, closed-day rest flags, and weekly naftalan cap 5.

### ICD-10 catalog (CLI-39…42)

1. **`/sanatorium`** — single ICD searchable picker for `I10` or «гипертенз»; add diagnosis (selectable category/leaf only) + optional note; delete diagnosis from chart; then **Complete checkup & schedule program**. Chapter/BLOCK codes must not save. Empty chapter list must not block search (catalog must be seeded: `node prisma/load-icd10.cjs`). Search `M42` → only `M42`, `M42.0` (Юношеский остеохондроз позвоночника), `M42.1`, `M42.9`; no `M42.2…M42.8`.
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
3. **/nurse** + **/sanatorium** — nurse day board is the four-column board with fullscreen; the resource matrix keeps its own board. Primary/success/danger/muted match DESIGN.md via kit tokens.
4. **/lab-orders** create (external) — DatePicker + FieldSelect; no native date-only chrome.

### Pattern B outpatient (practitioner matrix)

1. **`/appointments`** — rows = doctors; click free slot to book; DnD to move (optional other practitioner row). A closed weekday (default Sunday) or a non-working production-calendar day returns no board rows. Booking or rescheduling a visit onto that day returns 409 `CLOSED_DAY` (patient card shows the closed-day message).
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
3. Clinic **`/admin/master-data`** — **Add practitioner** hidden; banner points to CP Workforce; edit staff kind and skills only.
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
10. **Gap closeout:** role without `api:catalog.read` → `GET /api/imaging-phrases` **403**. Without `api:lab_orders` → `POST /api/lab/import` **403**. Legacy `/api/templates` and `/api/admin/clinical-templates` **removed**. After upgrade, customized matrices: **Reset to defaults** (or grant `screen:admin.program_templates`) so new keys appear. Legacy `screen:admin.templates` expands to diagnostic_catalog + program_templates on parse.
11. **Data scope:** DOCTOR without `scope:episodes.all` (default) → `GET /api/sanatorium/episodes` returns only episodes with a visit / prescription / allocation for that doctor’s Practitioner; detail of another doctor’s episode → **404**. Grant `scope:episodes.all` → full list. Same for labs with `scope:lab_orders.all`. After upgrade: **Reset** RECEPTION/NURSE/LAB_TECH/CLINIC_ADMIN so they gain `scope:*.all`.
12. **Custom role (chief doctor):** Create role `CHIEF_DOCTOR` clone from `DOCTOR`; set **staffKind=DOCTOR** if needed; enable `scope:episodes.all` + `screen:patients`; Save. On the same page **Staff role assignment** — pick a user → `CHIEF_DOCTOR`. Chief sees another doctor’s episode (**200**); plain DOCTOR still **404**. Delete custom role only when `userCount=0`.
13. **FO manager permission (no role-name bypass):** Uncheck `api:procedures.fo_manager` on **CLINIC_ADMIN**, Save + refresh. Package assign modal must **not** show out-of-package Replace solely because role is CLINIC_ADMIN. Re-check permission → Replace returns.
14. **Ops:** after image/DB upgrade run clinic Prisma migrate so `Role.is_system` / `staff_kind` / `clone_from_code` exist; first login or `/admin/access` runs `ensureSystemClinicRoles`.
15. **Empty matrix (Wave 3 hole-close):** Uncheck **all** grants on **CLINIC_ADMIN**, Save + refresh. Admin screens and APIs **403** — access must **not** fall back to the full role template. If pre-upgrade the UI showed an empty matrix but access still worked, use **Reset to defaults** after this wave. JWT without `permissions[]` (legacy session) → re-login (fail-closed pages).
16. **Print gates:** role without `screen:reception.extra_tickets` → `/print/extra-ticket/…` forbidden. Without `screen:lab_orders` → `/print/lab-order/…` forbidden. NURSE with `screen:reports.procedures` (no `screen:doctor`) may open `/print/procedures/…`; with `screen:lab_orders` may open `/print/usm/…`. Course summary `/print/episode/…` any-of `screen:doctor` \| `screen:sanatorium` \| `screen:patients` (reception via sanatorium). Visit-exam print still any-of `api:visits` \| `api:patients`.



## Print forms (CLI-34)

1. Admin -> Settings -> Print branding: set AZ clinic name + phone; save.
2. Lab order workflow -> Print -> three language chips (UI locale selected) -> Print opens the form and the print dialog. Same chips on the episode summary, the procedure sheet, and the visit exam.
3. Patient card stay strip **printer** → language dialog → `/print/episode/…?episode=` (stay, anamnesis, complaints, ICD, labs, exam notes, seated procedures). OPEN course still prints (interim note). Results **per-row** print (lab/USM) and Plan **Print schedule** stay separate. Check-up form remains at `/print/checkup/...` (no header button on Results/intake).
4. Qualitative analyte (if configured): enter via select; reprint in another language shows translated label.

## Extra tickets (Nafta dual-run, HOT-06)

**Lab (Wave 6):** CI `saas-wave6-hot06-lab` (clinic + hotel) + Super-Admin policy / Issue-ticket UI path — see [`reports/hot06-lab-signoff.md`](../../reports/hot06-lab-signoff.md). Lab unlocks **SHOW** for Super-Admin policy + this Issue-ticket screen. Extension SPA Insert stays **HEADLESS** / field-open. **Not SHIPPED**.

**Field runbook:** [`reports/hot06-field-runbook.md`](../../reports/hot06-field-runbook.md) — do not mark HOT-06 SHIPPED until field checklist is pass.

Prerequisite (ops): clinic cutover policy `elektrawebDualRun` + Sync; hotel org `writeEnabled` + Sync; pool kill switch; extension on **sanatorium** desk with Write ON and SPA open.

1. Doctor assigns a paid extra (`PENDING_PAY` on Müalicə kartı / extras modal — price shown).
1a. Admin → Settings → **Paid extra before payment**. Default **On the plan, marked unpaid**: doctor and reception see the row on the Plan tab with status Unpaid and no clock. Guest procedure print and the episode summary include it with an unpaid mark and empty time and room. Nurse, QR, and the resource matrix do not list it. **Hold until payment** hides it from the plan and those prints until pay or folio. Pay / folio still seats the row and drops the mark.
2. **`/reception/extra-tickets`** — filter by patient/procedure/origin; row **Banknote** or select rows → **Pay**. ERA posts each line to the hotel folio, places them on the schedule, then opens one cheque that lists every paid line (room number + catalog name in the print language) in 3 copy windows (`/print/extra-ticket/…`).
3. Confirm hotel health `writeEnabled` and outbox not stuck `FAILED`. Unknown SPA product must fail enqueue (do not guess).
4. **`/nurse`** — extra without ticket → check-in blocked (`TICKET_REQUIRED`).
5. Walk-in extra lands on Elektraweb **Tibbi Ambulator** house folio / hotel cashier path, not clinic cashier (field).
6. Explicit guest decline → delete `PENDING_PAY`; episode close / hotel check-out auto-purges unpaid pending.

```bash
cd era-clinic && npm test -- --testPathPattern=saas-wave6-hot06-lab
cd era-hotel-pms && npm test -- --testPathPattern=saas-wave6-hot06-lab
```

## Episode procedure assign (CLI-57)

**Status:** SCREEN — not SHIPPED / not Pilot. ADR `docs/adr/clinic-episode-procedure-assign-modal.md`.

1. **In-house** patient card **Package** tab: **Procedures in package** `+` → left remaining / right assigned (one card per SKU); leftover draft icon +/−; physio form overlay aligned with the left list top; **Save** places. **Saxla** seats new lines **top-to-bottom in add order** (first row claims the day first). Daily free cap is **per package block** (`ProgramTemplateProcedure.dailyDistinctCap`; empty = physio 3, bath 1, paraffin 1). A new SKU past that block's limit toasts **this package block's daily limit is used up** (`day_full`, not “no staff”). A paid extra that belongs to the block shares that cap and does not burn quota. Bath and paraffin lines have **Əvəz et** before Hamısı; a replacement spends the predecessor block's daily cap. **Plan** tab lists every still-open procedure of the episode (no 25-row page). Reschedule from the plan card can change the day; the resource matrix stays on the same day. The move uses the same slot door: block daily cap, bath rest day, weekly naftalan cap, and a checkout day only when the procedure ends by 12:00. A later day is refused. **Print** shows the checkout day even when it has no procedures, and its last line is **12:00** check-out. Plan chips + print stay in the same card frame. Language picker must sit **above** the card. Print **Doctor** = episode care team (not cabin/roster nurse).
2. **Walk-in:** package block hidden; **Additional procedures** only; reception Pay requires payment receipt/cheque ref.
3. Extras modal shows unit price + muted total; Save → `PENDING_PAY`. **Plan before payment** (default) seats each extra on its own day and cabin. Plan tab and guest print show that time and room with an unpaid mark. **Wait for payment** keeps the row off the plan and those prints, with no cabin.
4. `/reception/extra-tickets` → date/time column as `DD.MM.YYYY HH:mm` from `scheduledAt` (cabin optional); nearest first. Row money icon or ticked rows → Pay. A seated row stays on its cabin. One cheque lists every paid line, 3 copy windows. Trash on a row cancels that unpaid procedure only.
4a. After clinic `dayEndHour`, cron `procedure-no-show-sweep` marks today's seated unpaid extras `UNPAID_MISSED`, plus overdue `scheduledAt` and unseated rows created before today. Future-dated seated stay. Hotel check-out / walk-in close clears every remaining unpaid on the episode (including unseated).
5. Nurse `/nurse?mine=1`: a seated unpaid extra shows a red **Ödəniş edilməyib** block and no check-in (Queue while before deadline, Late after). QR and check-in stay closed until the ticket. Paid without ticket → check-in `TICKET_REQUIRED`.
6. **Bath replace:** Package modal **Əvəz et** on the bath or paraffin line (before Hamısı) — unused leftover (not completed/checked-in) → another SKU as **free package** quota (`XFER-{predecessor}--{sku}`). Reason required. Info before Hamısı shows date, qty, and reason. The replacement spends the predecessor block's daily cap. **Not** auto-seated. Folio/`PENDING_PAY` must not apply. Completing a legally seated package line does not flip it to paid because the day already has three package procedures.
6b. After **Saxla**: one green toast per seated SKU (`qty × name`) and one red toast per missed SKU; Plan tab reloads. Care team trash asks confirm. `/lab-orders` create: guest picker + catalog chips; no Visit ID / create-modality.
7. Print schedule: procedure name with params under title. Extra tickets: Pay opens **3 windows** for the batch (reception / nurse / guest), and each window lists every procedure on that receipt.
8. Package modal: CHECKED_IN rows grey locked; `−1` reduces SCHEDULED qty; laterality saved on sites.
9. **Package left menu** and the package-tab quota bars list a block only when it is in the course snapshot and **Show in procedures** is on, in procedure-list order. A block with the box off (typical lab or exam) is absent. `XFER-` stays under **Əvəz edilmiş prosedurlar**. `+` / **Hamısı** on a lab block creates a lab order; on an exam block, a visit; the physio form and the start-time dialog stay for procedure blocks. Save of a hidden code is `NOT_IN_PROCEDURES`. The quota editor has no block-code field; a new block stores `BLK-…`. Print shows the name, not the code.
10. Opening package assign on an OPEN episode **without** `ProgramInstance` returns **200** + `blockReason` (`NO_PROGRAM_CODE` / `NO_PROGRAM`) — modal shows how to set/open the package (not a generic load failure). Mutations still 409 `NO_PROGRAM`.
11. **Naftalan vannası** overlay: title + **Miqdar** top-right (no duplicate Prosedur field); fill Tam / Oturaq (above navel) / Qurşaq (waist); no zone chips / Tətbiq; **Vanna ardıcıllığı** only if qty > 1. Overlay top aligns with **Paket qalığı** list.
12. Assigned card copy: `Name ×qty (draft)` then one param per line (`naftalanFill`, `dayBlock`, `bathSequence`). Same SKU must not split into multiple cards.
13. Guest / Doctor / Diagnostics / Plan / Package share one patient-card frame; assign is a modal inside that card. Assigned bath cards show the day-series calendar. Sanatorium list: green / yellow / red course mark and a status filter. Day series and Word blank upload use the procedure-rules and LIS screen permissions.

```bash
cd era-clinic && npm test -- --testPathPattern=cli57-package-assign
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

1. **Module off → 403:** With `industry_clinic` inactive for the session org, operational routes (module gate inside `getSatelliteSession()`) return **403** (`Industry module not active: industry_clinic`). Proof: `__tests__/cli-*-negative.spec.ts`.
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
4. After catalog seed + Apply `#31` (skip `#32`): patient **2019** shows **three** USG rows (`USG-BREAST` / `USG-THYROID` / `USG-ABD`) with organ fields plus original Qeyd (`sourceNote`). `/lab-orders` date is clinical day (`collectedAt`), not Apply time. After this deploy: re-Apply `#27` so lab rows have `LabOrderItem` (not empty COMPLETED shells) and single-test Word files (Dimer/CRP/PRL/Insulin/Hormon) bind to catalog codes.
5. Intake checklist: after the first care-team doctor, the card section **İlkin diaqnostik prosedurlar** lists auto analyses and auto diagnostics from the current package template. It does not show a fixed four-row Nafta list. Check-up print form remains at `/print/checkup/...`.
6. Live check-in: opening an episode does not create ECG/USG by itself. The first care-team doctor creates the template's auto analyses and diagnostics. The package opens only when anamnesis, one complaint, and one ICD-10 are all present.
7. After re-Apply `#23` (Baku `+04:00` slot parse): Yağmur — two Solyuks times both visible; compact PLAN date+time matches modal for the same `procedure:{id}`; **Növbəti** is nearest `scheduledAt >= now` in Baku (not a 2024 leftover). No 18:36↔10:36 jump after re-import.

## CLI-49 — Physio sites (W2–W4)

SatAdmin:

1. Sign in as `CLINIC_ADMIN`. Open **Catalogs → Physio sites** (`/admin/physio-sites`).
2. Tabs **Sites / Programs / Substances** list seeded rows (after Sync/login copy-if-empty from satellite templates, or `npm run db:seed` then bind; Nafta WO aliases via import / `db:seed:physio:nafta`).
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
2. **Complete checkup** → Select one of `PKG-STANDART` / `PKG-PREMIUM` / `PKG-DERMA` / `PKG-DETOKS` (empty allowed until submit; ICD/complaint still required).
3. Walk-in registration uses the same four-code Select.
4. Open `/sanatorium?episode=<id>` → patient card opens on the Package tab.
5. Patient card «Gün planını aç» href lands on that deep link.

## Visit CPOE / diagnostic SoT (CLI-10)

**Status:** SHOW — print + card entry; FHIR / whole-visit print remain debt.

1. [x] `/admin/diagnostic-catalog` → Services → **Visit templates** filter → edit fields via field designer (not raw JSON only).
2. [x] `/admin/program-templates` visible only with `screen:admin.program_templates` (not legacy templates key).
3. [x] Doctor: open `/visits/[id]` → pick visit template → fill fields → Save → history row appears.
4. [x] History row → **Print exam** → language dialog → `/print/visit-exam/[cpoeEntryId]` opens and print dialog appears (one entry; diagnoses block; snapshotted labels).
5. [x] Patient card → **Exam notes** section → print icon → same print route.
6. [x] Role without `api:visits` and without `api:patients` → `/print/visit-exam/...` redirects forbidden.
7. [x] Legacy `/api/admin/clinical-templates` and `/api/templates` routes are **gone** (404).

## Program quota knots (CLI-51 / Wave B)

**Status:** Engineering API — not SHIPPED.

1. `/admin/program-templates` — edit entitlement blocks (member SKUs) + knots matrix; composition save bumps version (open stays stay pinned). Empty list shows empty-state row. Print (next to the editor close control) opens a landscape sheet: block name, members (analytes for lab panels, procedure or exam names otherwise), assign mode, quota type, and one column for every night currently on the matrix (defaults 7/10/14/21 plus any added length such as 8 or 9). A stay-basis block repeats its stay quantity in each of those columns. No separate stay-qty column.
2. Instantiate Standart 12 nights → bath quota 9; Premium 13 nights interpolates.
3. Extend/shorten stay from hotel → clinic recalc totals; SCHEDULED procedures remain.
4. Standart→Premium: used baths count against new total; no SCHEDULED cancel.
5. In-quota procedure/lab/visit charge = 0 AZN; over-quota = the catalog price; walk-in without package paid; guest with `noPackageConfirmedAt` paid; missing price → `priceMissing` (admin `?missingListPrice=1`).
6. **W2 block axes:** set assignMode / quotaBasis / requiresDoctor on a block; **İcra is not shown** (LAB→lab order, EXAM→visit, treatment→procedure). Membership list follows block kind (labs from diagnostic catalog, not SVC physio). AUTO badge appears; PER_STAY shows one stay-qty cell.
7. Open episode with AUTO_ON_OPEN lab block → LabOrder created; requiresDoctor visit without care team → `PENDING_DOCTOR`; add care doctor → auto retry.
8. `/sanatorium` list shows packageSignal badge when not OK; Confirm no package stamps `noPackageConfirmedAt`; **Undo no-package** clears it, and assigning a package clears it automatically (guest stops being billed at list price).
9. `POST /api/sanatorium/episodes/[id]/package-apply` retries auto blocks (api:procedures.confirm).
10. Complete a procedure on a hotel episode **without** a package code: amount stays 0 (`awaiting_package`) **and** a `ProcedureChargeLog` row appears — delivered work must not vanish from the cashier backlog.
11. Order a lab for a code with no catalog price on a paid path (walk-in / confirmed no-package): line posts `DEFAULT_OVER_QUOTA_AZN`, never 0, and the code still appears in `?missingListPrice=1`.
12. Switch package on an open episode: codes added by the switch show `quotaUsed` matching already-created in-package fulfillments (not 0).
13. Cancel an intake lab, then `package-apply` → the lab is re-created (a cancelled order must not block retry).
14. With `procedureOverQuotaPolicy = BLOCK`, ordering an over-quota package lab returns 409 `LAB_OVER_QUOTA_BLOCKED`.

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
6. **Idempotency:** duplicate `CHECKED_IN` / from-stay for the same reservation + pax (or primary without MDM) must **not** create a second `P-*` / OPEN episode — reopen the existing stay (`hotelStayId` + Serializable).

## Episode as care course (CLI-55) — SCREEN

**Status:** SCREEN (waves W1–W4 landed). Keep SCREEN until field punch — do not claim SHIPPED / SHOW / Pilot.

ADR: [clinic-episode-as-clinical-course.md](../../docs/adr/clinic-episode-as-clinical-course.md).

1. Patient card — episode CatalogField (default latest); anamnesis (+Anamnesis modal once per episode, then edit; author specialty + name under text) above CI → complaints/ICD (author under each row) → clinical blocks; CLOSED = read-only.
2. Empty OPEN anamnesis → confirm procedures disabled / API `409 ANAMNESIS_REQUIRED`; demographics save works without anamnesis.
3. Second OPEN walk-in for same patient → `409 WALK_IN_OPEN_EXISTS`.
4. `/sanatorium` Close on idle WALK_IN; refuse when live procedures or open labs remain (no silent cancel).
5. Returning guest intake creates ECG/USG on the **new** episode (does not skip last year’s labs).
6. Print checkup/procedures with `?episode=` for a past course does not mix the new stay.

## Episode care team (CLI-56) — SCREEN

**Status:** SCREEN. Not SHIPPED. ADR: [clinic-episode-care-team.md](../../docs/adr/clinic-episode-care-team.md).

1. Reception opens patient card from `/sanatorium` → sees identity + package + **Care team** only.
2. **+ Doctor** (therapist / gyn / uro …) → Save → doctor with assigned-only scope sees the course on `/sanatorium`.
3. Clinical blocks (anamnesis, CI, complaints/ICD, plan/confirm) appear only after ≥1 care-team doctor.
4. Empty care team → API `409 CARE_TEAM_REQUIRED` on anamnesis / complaints / diagnoses / complete-checkup / procedure assign.
5. Doctor already on team can **+ Doctor** peers; first assign requires RECEPTION/admin (`scope:episodes.all`).
6. Appointments linkage deferred (Pattern B `/appointments` unchanged).
7. `VISIT-SANATORIUM-INTAKE` checklist → **Keçdi/Passed** when OPEN episode has anamnesis + ≥1 complaint (diagnosis optional).
8. Same trigger **auto-opens** stay `programCode` as `PROPOSED` (`tryOpenProgramAfterTherapistStage`) — do not wait for labs. Then Confirm 2–3.
9. `/sanatorium` list rows: light sky tint when care team assigned; light red tint when not.
10. If episode has no `programCode`, proposed stays empty until package is set (walk-in Select / hotel product).

## Bath day series, clinic days, Word lab blanks (CLI-58 / 59 / 60) — SCREEN

**Status:** SCREEN. Not SHIPPED until these steps pass on a pilot org. Migration `20261015120000_day_series_calendar_blanks` must be applied first.

1. `/admin/procedure-rules` → **Day series** tab lists NAFTALAN / HYDRO / IODINE (created by the planning import only when missing) → edit members → Save.
2. `/sanatorium` → patient card → package modal → **Saxla** seats naftalan and paraffin on the same day at **different** minutes (guest overlap is refused). No mini calendar.
3. `/admin/settings` → **Clinic days** → close one civil day → schedule recalc preview lists moved sessions → Apply (super-admin only). Recalc does not stack two sessions at 09:00 for one guest.
4. Super-admin: paste episode id → **Preview reseat** / **Reseat future plan**. Future `SCHEDULED` retimes; `CHECKED_IN` / `COMPLETED` stay. Do not delete orders.
4a. Default week template keeps Sunday closed. Saxla / matrix has no Sunday slots unless `/admin/settings` opens that civil day. Super-admin **Preview closed days** / **Move off closed days** shifts leftover Sunday `SCHEDULED` to the next working day (not a full stay recalc).
4b. Resource-matrix reschedule stays on the same day (409 `CROSS_DAY` when the day changes). The plan card can change the day through the same door: block daily cap, bath rest, weekly naftalan, closed clinic, and a checkout day only when the procedure ends by 12:00. The next day is 409 `PAST_CHECKOUT`. Paid same-day `POST /api/procedures` seats through the same pin-day grid; a closed day is 409 `CLOSED`.
5. `/admin/lis-profiles` → **Word blank** mapper → upload a `.docx`, map analytes to cells → Save.
6. Open lab order → results step → pick the blank profile → upload a filled `.docx` from the lab → mapped analyte values appear in the result lines → Save.
7. Apply any package → the course has `LAB-CBC` and `LAB-URINE`; urine reference shows U-SG 1010–1030 and U-PH 6.0–7.4.

