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

1. **`/admin/master-data`** — add/edit practitioner with FIN/passport MDM lookup (resolve path), phone, default slot minutes; link to wards.
2. **`/admin/wards`** — create/edit/delete ward and bed via modals.
3. **`/patients`** — register patient; **`/patients/[id]`** — edit patient modal; contraindication add/remove modals on body map.
4. **`/appointments`** — **New appointment** modal; cancel visit via modal (reason required).
5. **`/lab-orders`** — **New lab order** modal from patient list.
6. **`/visits/[id]`** — complete confirm modal; issue prescription modal; discount modal.
7. **`/executive`** — filter by date and practitioner; KPI from API.
8. **`/cashier?visitId=`** — pay shows mock fiscal badge and full receipt/fiscal fields.

Coverage: [COVERAGE_MATRIX.md](../../docs/COVERAGE_MATRIX.md) CLI-*.

