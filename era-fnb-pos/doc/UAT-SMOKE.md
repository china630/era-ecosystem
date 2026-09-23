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

1. **UI:** `/login` — enter **ERA ID** (`orgNo`, six digits) on SHARED pool; optional `?org=` prefill. Owner login posts `{ "login", "password", "orgNo" }` (not UUID `organizationId`).
2. **API (DEDICATED / appliance):** `POST /api/auth/login` `{ "login": "waiter", "password": "waiter" }` — session cookie. **SHARED:** add `"orgNo": "104221"`.
3. **PIN floor:** `/pin?org=104221` — posts `{ "pin", "orgNo", "outletId" }`.
4. `GET /api/menu` — seeded items
5. `GET /api/menu?dailyOnly=true` — board uses **Asia/Baku** civil `@db.Date` (`bakuCivilUtcDate(todayBakuYmd())`), not host midnight / UTC slice
6. Manager: `/admin/menu` — modal CRUD category + dish; price history; optional recipe SKU + image URL
7. Manager: `/admin/tables` — create/edit/delete static tables
8. Manager: `/admin/daily-menu` (or DailyMenuAdminPanel) — default board date = Asia/Baku today
9. RBAC Variant A: doors are grants (`api:*` / `screen:*`), not role names. Waiter can fire/pay (hotel); manager required for void/Z — strip void on `/admin/access` → API 403. Kitchen without `screen:admin.menu` cannot open that page. Kitchen also cannot `GET /api/tickets` / `GET /api/menu` (till-read grants).

## FNB-RBAC-01 — access matrix (SCREEN; not SHIPPED)

1. Manager login → `/admin/access` — edit `FB_MANAGER`, uncheck `api:tickets.void`, Save, refresh-permissions.
2. Attempt void line → 403.
3. Kitchen PIN (bound outlet) → `/admin/menu` redirects forbidden; `/kds` OK if grant + SKU; `GET /api/tickets` → 403.
4. PIN without `StaffRoster.outletId` → 403 `PIN_OUTLET_UNBOUND`.
5. Kafe edition: waiter package has no `api:tickets.pay` → pay 403 `FNB_WAITER_NO_PAY`.
6. `POST /api/outlets/select` requires `admin:outlet_bind`; PIN session always 403 (cannot rebind).
7. Roster create requires `outletId` + `admin:staff_pin` | `api:labor.roster.write`.
8. Cutover import: PIN session forbidden even with grant.

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
3. **Own mode**: `POST /api/tickets/{id}/pay` `{ "method": "CASH" }` → **201**, local fiscal (`@era/fiscal` mock; empty device catalog → recorded_no_device)
4. In-house: `PATCH /api/tickets/{id}` `{ "roomChargeReservationId": "<uuid-or-room>" }`
5. `POST /api/tickets/{id}/pay` → **400** (settle via room charge)
6. `POST /api/tickets/{id}/room-charge` → folio charge on hotel PMS
7. **UI (F3):** Open shift modal — optional KKM / bank POS select from `GET /api/fiscal/devices`; bound ids stored on `PosShift`

## Quartet (Track A)

1. `node scripts/quartet-smoke.mjs` â€” FB health 200 when dev server up
2. `node era-hotel-pms/scripts/test-pos-bridge.mjs` â€” bridge regression
3. KKM: with a synced mock device, pay returns `fiscal.driver` = `mock`; empty catalog returns skipped `recorded_no_device` (not an env mock receipt)
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

## ERA Kafe (street café on SHARED F&B pool)

1. Orch `/kafe` → `POST /v1/public/kafe/onboard` creates org `subscriptionPlan=kafe`, endpoint on existing F&B pool URL.
2. Owner `/login` (password) ≠ cashier `/pin`.
3. Floor: empty ticket; tap dish adds line; **bitdi/var** on the tile; hotel APIs 403.
4. Cashier PIN pays; waiter PIN cannot settle (403 `FNB_WAITER_NO_PAY`).
5. Optional Zal/KDS/QR SKUs; QR `/m/{slug}` is read-only (POST 405).
6. Excel `/api/menu/export` includes price history; suggest `/api/menu/suggest?q=`.
7. Offline pay queues when network is down; replay on `online`.



