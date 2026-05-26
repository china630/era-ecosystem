# UAT smoke — era-logistics





## SSO paths (platform entry - SP9/P2)

### Owner path (Orchestrator)
1. Login at Orchestrator web: `http://localhost:3100` ([QUARTET_UAT.md](../../docs/QUARTET_UAT.md)).
2. Home → industry tile → **Open** → satellite `/sso/callback` session.
3. Smoke: `node scripts/sso-launch-smoke.mjs` (`ERA_SSO_SHARED_SECRET` aligned).

### Ops path (local)
1. Use this app's `/login` and seed users in sections below.
2. Billing, team, register → Orchestrator only (no satellite `/register`).



## L0

- [ ] `GET /api/health` → 200
- [ ] Home page loads
- [ ] `POST /api/events/dispatch` (with orchestrator running)

## L1

- [ ] `POST /api/trips` with `vehiclePlate`, `freightAmount` → 201
- [ ] `POST /api/trips/:id/complete` → status `COMPLETED`, event dispatched
- [ ] `/trips` list shows trips

## L2 (SW4)

- [ ] `GET /api/trips/:id` → trip + vehicle
- [ ] `PATCH /api/trips/:id` `{ "status": "IN_TRANSIT" }` from `PLANNED`
- [ ] `PATCH /api/trips/:id` `{ "status": "DELIVERED" }` from `IN_TRANSIT`
- [ ] `POST /api/trips/:id/pod` `{ "recipient": "...", "notes": "..." }`
- [ ] `POST /api/trips/:id/fuel-report` `{ "liters": 45.5, "cost": 68.25 }`
- [ ] `GET /api/reports/fuel?from=2026-05-01&to=2026-05-31` → totals + `byVehicle`
- [ ] `/trips/[id]` — POD form, fuel form, status actions, complete
- [ ] `/reports/fuel` — summary table for date range

## W1-E — Enrichment

- [x] M3: `POST /api/trips/:id/waybill` → `waybillNumber`; UI issue on `/trips/[id]`
- [x] M7: `GET /api/fleet/alerts` + `/fleet` expiry list (seed vehicles with near dates)
- [x] M4: `POST /api/trips/:id/pod` with `podPhotoUrl`, `podSignatureUrl`
