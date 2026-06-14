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
- [ ] `/executive` — `BUSINESS_OWNER` sees visits today, lab revenue, open orders
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
2. Open **`/inpatient`** from sidebar (Inpatient wards).
3. Click **Assign bed** — enter ward code (e.g. `W1`), bed code (e.g. `B01`), and a valid `patientRefId` from an existing patient/visit → **Assign**.
4. Confirm ward card appears with bed tile **OCCUPIED** and patient name/ref.
5. Click **Discharge** on the occupied bed → bed returns to **AVAILABLE**; tile shows assign button again.
6. API smoke (optional): `GET /api/inpatient` → `{ wards: [...] }`; `POST /api/inpatient` assign; `PATCH /api/inpatient/assignments/[id]` discharge.

