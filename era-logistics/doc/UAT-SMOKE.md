# UAT smoke â€” era-logistics





## SSO paths (platform entry — v1.0)

### Owner path (Orchestrator)
1. Login at Orchestrator web: `http://localhost:3000` ([QUARTET_UAT.md](../../docs/QUARTET_UAT.md)).
2. Home â†’ industry tile â†’ **Open** â†’ satellite `/sso/callback` session.
3. Smoke: `node scripts/sso-launch-smoke.mjs` (`ERA_SSO_SHARED_SECRET` aligned).

### Ops path (local)
1. Use this app's `/login` and seed users in sections below.
2. Billing, team, register â†’ Orchestrator only (no satellite `/register`).



## L0

- [ ] `GET /api/health` â†’ 200
- [ ] Home page loads
- [ ] `POST /api/events/dispatch` (with orchestrator running)

## L1

- [ ] `POST /api/trips` with `vehiclePlate`, `freightAmount` â†’ 201
- [ ] `POST /api/trips/:id/complete` â†’ status `COMPLETED`, event dispatched
- [ ] `/trips` list shows trips

## L2 (SW4)

- [ ] `GET /api/trips/:id` â†’ trip + vehicle
- [ ] `PATCH /api/trips/:id` `{ "status": "IN_TRANSIT" }` from `PLANNED`
- [ ] `PATCH /api/trips/:id` `{ "status": "DELIVERED" }` from `IN_TRANSIT`
- [ ] `POST /api/trips/:id/pod` `{ "recipient": "...", "notes": "..." }`
- [ ] `POST /api/trips/:id/fuel-report` `{ "liters": 45.5, "cost": 68.25 }`
- [ ] `GET /api/reports/fuel?from=2026-05-01&to=2026-05-31` â†’ totals + `byVehicle`
- [ ] `/trips/[id]` â€” POD form, fuel form, status actions, complete
- [ ] `/reports/fuel` â€” summary table for date range

## Product modules (v1.0)

- [x] M3: `POST /api/trips/:id/waybill` â†’ `waybillNumber`; UI issue on `/trips/[id]`
- [x] M7: `GET /api/fleet/alerts` + `/fleet` expiry list (seed vehicles with near dates)
- [x] M4: `POST /api/trips/:id/pod` with `podPhotoUrl`, `podSignatureUrl`

## v1.1 — M10–M12 (DONE)

- [x] M10: `POST /api/shipments/:id/rate` tariff quote
- [x] M11: COD settle API (`/api/cod`)
- [x] M12: hub scan (`/api/hub`)

