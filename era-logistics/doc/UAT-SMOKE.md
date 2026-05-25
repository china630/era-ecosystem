# UAT smoke — era-logistics

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
