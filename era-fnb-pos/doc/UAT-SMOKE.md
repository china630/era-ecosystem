# UAT smoke â€” era-fnb-pos





## SSO paths (platform entry — v1.0)

### Owner path (Orchestrator)
1. Login at Orchestrator web: `http://localhost:3000` ([QUARTET_UAT.md](../../docs/QUARTET_UAT.md)).
2. Home â†’ industry tile â†’ **Open** â†’ satellite `/sso/callback` session.
3. Smoke: `node scripts/sso-launch-smoke.mjs` (`ERA_SSO_SHARED_SECRET` aligned).

### Ops path (local)
1. Use this app's `/login` and seed users in sections below.
2. Billing, team, register â†’ Orchestrator only (no satellite `/register`).



## FB-0 â€” Scaffold

- [x] `GET /api/health` â†’ 200
- [x] Home / floor pages load
- [x] Prisma Ticket model + `POST /api/tickets`
- [x] Room charge bridge: `POST /api/tickets/{id}/room-charge`

## FB-0 — Auth & menu

1. `POST /api/auth/login` `{ "login": "waiter", "password": "waiter" }` — session cookie
2. `GET /api/menu` — seeded items
3. Manager: `/admin/menu` — modal CRUD category + dish; price history; optional recipe SKU + image URL
4. Manager: `/admin/tables` — create/edit/delete static tables
5. RBAC: waiter can fire/pay; manager required for void line and Z-close

## FB-3 — Standalone GL (no hotel)

1. Org STANDALONE / settlement not hub — walk-in ticket → **Pay cash**
2. Expect Finance ingest `SATELLITE_FB_SALE_COMPLETED` (journal ref `fb-sale:{receiptId}`)
3. Manager Z-close → `SATELLITE_FB_SHIFT_CLOSED`
4. In-house room-charge path must **not** emit `SATELLITE_FB_SALE_COMPLETED`

## FB-1 — MVP Nafta

1. UI: `/orders` → **POS shift** panel → Open shift — or `POST /api/shifts/open`
2. `GET /api/tables` â€” pick a table id
3. `POST /api/tickets` `{ "tableId": "...", "lines": [{ "description": "Soup", "qty": 2, "unitPriceAzn": 8 }] }`
4. `POST /api/tickets/{id}/fire` â€” lines â†’ FIRED
5. `GET /api/kds/lines` â€” queue visible; `PATCH /api/kds/lines/{lineId}` `{ "kitchenStatus": "DONE" }`
6. UI: `/orders` → **Pay cash** or **Pay card** (or API `{ "method": "CASH"|"CARD" }`)
7. Room charge (with hotel-pms running, or `FB_POS_PMS_STUB=1`):
   - UI: `/orders` → **In-house guest** search → link → **Room charge**
   - API: `GET /api/in-house?query=201` · `PATCH /api/tickets/{id}` · `POST /api/tickets/{id}/room-charge`
8. Void: open new ticket + line â†’ `POST /api/tickets/{id}/lines/{lineId}/void` `{ "reason": "wrong item" }`
9. UI: manager **Z-close** on shift panel — or `POST /api/shifts/close`

## FB-1b — Mixed settlement (Nafta)

See [ADR fb-mixed-settlement-routing](../../docs/adr/fb-mixed-settlement-routing.md) and [ADR unified-settlement-hub](../../docs/adr/unified-settlement-hub.md).

1. Walk-in ticket: `POST /api/tickets` `{ "serviceChannel": "WALK_IN", "walkInLabel": "Street", "lines": [...] }`
2. **Hub mode** (`settlementPolicy.deferWalkInToHub`): `POST /api/tickets/{id}/defer-to-hub` → **200**; pay at hotel `/front-cash/pending`; callback closes ticket
3. **Own mode**: `POST /api/tickets/{id}/pay` `{ "method": "CASH" }` → **201**, local fiscal
4. In-house: `PATCH /api/tickets/{id}` `{ "roomChargeReservationId": "<uuid-or-room>" }`
5. `POST /api/tickets/{id}/pay` → **400** (settle via room charge)
6. `POST /api/tickets/{id}/room-charge` → folio charge on hotel PMS

## Quartet (Track A)

1. `node scripts/quartet-smoke.mjs` â€” FB health 200 when dev server up
2. `node era-hotel-pms/scripts/test-pos-bridge.mjs` â€” bridge regression
3. KKM: pay returns `fiscal.driver` = `mock` (not stub flag)
4. Entitlement: pay without `platform_loyalty` in snapshot â†’ no promotion created in Orch (hooks gated)

## FB-4 — Banquet service day (UI)

1. `/floor` — outlet selector (`GET /api/outlets` + `POST /api/outlets/select`)
2. Banquet: pick active BEO from dropdown → **Open banquet ticket** → `POST /api/tickets` with `beoId`, `outletCode: BANQUET`
3. Walk-in: optional label → **Open walk-in ticket** → `serviceChannel: WALK_IN`
4. `/orders` — ticket list shows WALK_IN / BEO labels
5. Nav: **Daily menu** → `/admin/daily-menu`
6. Daily menu board: pick `Date`, bulk-select menu items (checkboxes), then `Save board` (PUT)
7. Optional: `Copy from yesterday` (POST) and re-open `/admin/daily-menu` to verify selection persists

## Quartet (Track C)

1. `GET /api/outlets` + `POST /api/outlets/select` â€” multi-outlet session
2. `POST /api/tickets/room-service` â€” room service ticket without table
3. Walk-in: `POST /api/tickets` `{ "walkInLabel": "Guest", "serviceChannel": "WALK_IN" }`
4. E8: `STOCK_CONSUMPTION_ENABLED=true` â†’ pay dispatches consumption event
5. `/admin/integration` â€” billing snapshot read-only

## Pass criteria

- `npm run build` succeeds
- Flows 1â€“9 complete without blocking errors
- With `HOTEL_PMS_URL` set, room charge appears on PMS folio (see [era-hotel-pms UAT Â§11](../../era-hotel-pms/doc/UAT-SMOKE.md))

## v1.1 — M14 (DONE)

- [x] `POST /api/labor/clock` PIN clock-in/out

## Deny (Scaffold BE negative paths)

1. **Module off → 403:** With `industry_fnb_pos` inactive (or unbound org / source=fallback), operational routes that call `assertFnbEntitled` return **403** (`Industry module not active: industry_fnb_pos`). Proof: `__tests__/fnb-pos-negative.spec.ts` (+ inv/labor suites).
2. **Foreign / empty org:** Unbound satellite (no CP bind, no env org) fails closed — same 403 path; list/mutation does not silently serve another tenant’s data.
3. **Domain denies:** CLOSED ticket refuses line/fire mutations; hotel-folio settlement blocks cash pay; VOID lines excluded from stock consumption; wrong PIN → 401 on `/api/labor/clock`.

