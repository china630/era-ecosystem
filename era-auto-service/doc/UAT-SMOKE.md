# UAT smoke — era-auto-service

## SSO paths (platform entry — v1.0)

### Owner path (Orchestrator)
1. Login at Orchestrator web: `http://localhost:3000` ([QUARTET_UAT.md](../../docs/QUARTET_UAT.md)).
2. Home → industry tile → **Open** → satellite `/sso/callback` session.
3. Smoke: `node scripts/sso-launch-smoke.mjs` (`ERA_SSO_SHARED_SECRET` aligned).

### Ops path (local)
1. Use this app's `/login` and seed users in sections below.
2. Billing, team, register → Orchestrator only (no satellite `/register`).

## Core

- [ ] `GET /api/health` → 200
- [ ] Home page loads
- [ ] `POST /api/events/dispatch` (with orchestrator running)

## M1 — Customer vehicle card

- [x] `POST /api/vehicles` with plate + optional `financeCounterpartyId`
- [x] UI `/work-orders`?plate=10` returns vehicle
- [x] VOEN lookup `/api/mdm/voen-lookup` links `vehicleId`

## M3 / M4 � Labor & parts lines

- [x] `POST /api/work-orders/:id/labor-lines` updates `laborAmount` aggregate
- [x] `POST /api/work-orders/:id/part-lines` updates `partsAmount` aggregate
- [x] `POST /api/work-orders/:id/complete` recalculates totals before event dispatch

See [SMOKE_ALL_SERVICES.md](../../docs/SMOKE_ALL_SERVICES.md) § Module maturity — Auto.

## Deny (Scaffold BE negative paths)

1. **Module off → 403:** With `industry_auto_service` inactive (or unbound org / source=fallback), `assertAutoEntitled` / `requireAutoSatellite` fail closed → **403**. Proof: `__tests__/auto-wo-negative.spec.ts` (+ appt/plat suites).
2. **Foreign / empty org:** Unbound satellite does not leak cross-org work orders/appointments; gate returns inactive before domain work.
3. **Domain denies:** COMPLETED work order refuses new labor/parts lines; appointment without `vehiclePlate` refused; cron with `PLATFORM_CRON_SECRET` and missing/wrong `Authorization` → **401**.

## Admin UI (modal CRUD)

1. Login as manager at `/login`.
2. Open `/admin/settings` → `Edit` workshop name in `ModalShell` → `Save`.
3. Open `/appointments` → `Book` modal → create appointment with `vehiclePlate` + datetime.
4. Open `/work-orders` → `Create work order` modal → save a new order.
5. On `/work-orders`, select the created order → add labor line, add part line, then `Complete work order`.
