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
- [ ] Home page loads
- [ ] `POST /api/events/dispatch` (with orchestrator running)

## K2 — Lab order lifecycle

1. `POST /api/lab-orders` with `visitId`, `testCodes[]`, patient ref → status `ORDERED`
2. Open `/lab-orders/[id]` — stepper UI loads
3. `POST /api/lab-orders/[id]/collect` → `COLLECTED`, `collectedAt` set
4. `POST /api/lab-orders/[id]/results` with `{ lines: [{ code, value }] }` → `RESULT_READY`
5. `POST /api/lab-orders/[id]/publish` → `PUBLISHED`, `publishedAt` set; if patient `phone` is email-shaped → orchestrator notification (EMAIL) when `CONTROL_PLANE_URL` + token configured
6. `POST /api/lab-orders/[id]/complete` → `COMPLETED` + `SATELLITE_CLINIC_LAB_ORDER_COMPLETED` event

## K2b — Appointment notifications (Nafta W0)

1. `POST /api/appointments` with patient phone → SMS notification via orchestrator when entitled (`ERA_NOTIFICATIONS_PACK` on control plane).

## K3 — Admin

- [ ] `/scheduling` — day grid loads from `GET /api/scheduling/slots?date=`
- [ ] `POST /api/visits/[id]/discount` — `CLINIC_ADMIN` or `BUSINESS_OWNER` only; audit row created
- [ ] `/executive` — date + practitioner filters; KPI from `GET /api/executive/summary`
- [ ] `GET /api/executive/summary` — 403 for non-owner roles

## Product modules (v1.0)

- [x] M6: `GET /api/catalog/services` + `POST /api/catalog/sync` seed cache
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
4. Open **`/inpatient`** — admit via bed + patient dropdowns; transfer/discharge from bed tiles.
5. API smoke (optional): `POST /api/inpatient` `{ action: "admit", bedId, patientRefId }`; `POST /api/cron/inpatient-daily-charges` with cron Bearer token.

## Presets + MDM (P1)

1. **Admin → Settings** — toggle product lines; disabled routes redirect from `/sanatorium` / `/inpatient`.
2. **Patients** — FIN + MDM lookup; masked `globalPersonId` badge on list.
3. **Appointments** — Cancel visit from selected appointment panel (K-15).

## Admin master data (2026-06-15) — UI paths (no curl)

Prerequisite: `chingiz@era.com` / bootstrap password, `CLINIC_ADMIN`; after `docker compose up clinic` seed runs (`RUN_SEED=true`).

1. **`/admin/master-data`** — add practitioner: FIN or passport+country required; MDM lookup; edit loads identifier types from MDM (re-enter to change). No plaintext FIN/passport on practitioner row.
2. **`/admin/wards`** — create/edit/delete ward and bed via modals.
3. **`/patients`** — register patient with transient FIN/passport; **`/patients/[id]`** — edit shows MDM identifier types; contraindication modals on body map.
4. **`/appointments`** — **New appointment** modal; cancel visit via modal (reason required).
5. **`/lab-orders`** — **New lab order** modal from patient list.
6. **`/visits/[id]`** — complete confirm modal; issue prescription modal; discount modal.
7. **`/executive`** — filter by date and practitioner; KPI from API.
8. **`/cashier?visitId=`** — pay shows mock fiscal badge and full receipt/fiscal fields.
9. **Settlement hub:** walk-in visit complete → hotel `/front-cash/pending`; `/cashier` shows hub banner and blocks pay when `deferWalkInToHub`.

## Sanatorium clinical day

Prerequisite: preset `sanatorium_clinical`; hotel guest with medical rate plan checked in; `programSchedulingMode=AFTER_CHECKUP`.

1. **`/sanatorium`** — episode visible; **no** procedures until checkup (complaint + ICD).
2. **Complete checkup & schedule program** → FIFO chart with 5-min slots; same procedure not twice same day.
3. **`/nurse`** — paste QR from hotel check-in (`guestQrToken`) → verify → **Start** → **Complete** → MEDICAL folio line on hotel.
4. **`/sanatorium/resources`** — read-only occupancy grid.
5. Reschedule procedure time on chart → conflict rules enforced.
6. Walk-in **Register walk-in** → program instantiate → billing per settlement hub or cashier.
7. Early hotel check-out → future procedures **CANCELLED** (lifecycle consumer).

Coverage: [COVERAGE_MATRIX.md](../../docs/COVERAGE_MATRIX.md) CLI-*.

## Platform catalog gateway (Wave 2)

Prerequisite: orchestrator `:4000` + data-hub `:4200`; `SATELLITE_EVENT_SERVICE_TOKEN` + `ERA_SATELLITE_ORGANIZATION_ID` on clinic container.

1. **`/scheduling`** — pick a known non-working day (public holiday in hub seed); new appointment on that date is blocked or warned per clinic rules.
2. **`/appointments`** — follow-up date suggestion respects business-day calendar (orchestrator `/platform/v1/catalog/calendar/az/add-business-days` via satellite-kit).

## Workforce single path (Wave 3 / Plan C)

### Smoke — CP workforce hire (`cp_workforce`)

Prerequisite: org with `platform_workforce` + `industry_clinic`; orchestrator fan-out + clinic running.

1. Orchestrator → **`/workspace/workforce/security`** → confirm Therapist → clinic **DOCTOR** in role matrix (or seed via `scripts/nafta-onboard-departments.mjs`).
2. **`/workspace/workforce/employments`** → hire MDM person → Med Block → Therapist → **Clinic** checkbox → submit.
3. Clinic **`/admin/master-data`** — **Add practitioner** hidden; banner points to CP Workforce; edit specialty/slots only.
4. Local login as provisioned ops user → `/scheduling` or `/appointments` accessible per DOCTOR role.
5. (Optional) Security Admin manual grant **CLINIC_ADMIN** → admin routes; revoke → admin blocked, doctor OK.

