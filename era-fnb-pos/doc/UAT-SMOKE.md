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

## FB-0 â€” Auth & menu

1. `POST /api/auth/login` `{ "login": "waiter", "password": "waiter" }` â€” session cookie
2. `GET /api/menu` â€” seeded items
3. Manager: `POST /api/menu` create item; `/admin/menu` UI
4. RBAC: waiter can fire/pay; manager required for void line and Z-close

## FB-1 â€” MVP Nafta

1. `POST /api/shifts/open` `{ "outletCode": "RESTAURANT", "openingCash": 100 }`
2. `GET /api/tables` â€” pick a table id
3. `POST /api/tickets` `{ "tableId": "...", "lines": [{ "description": "Soup", "qty": 2, "unitPriceAzn": 8 }] }`
4. `POST /api/tickets/{id}/fire` â€” lines â†’ FIRED
5. `GET /api/kds/lines` â€” queue visible; `PATCH /api/kds/lines/{lineId}` `{ "kitchenStatus": "DONE" }`
6. Cash pay: `POST /api/tickets/{id}/pay` `{ "method": "CASH" }` â†’ ticket CLOSED, table FREE
7. Room charge (with hotel-pms running, or `FB_POS_PMS_STUB=1`):
   - `GET /api/in-house?query=201`
   - `PATCH /api/tickets/{id}` `{ "roomChargeReservationId": "<uuid-or-room>" }`
   - `POST /api/tickets/{id}/room-charge`
8. Void: open new ticket + line â†’ `POST /api/tickets/{id}/lines/{lineId}/void` `{ "reason": "wrong item" }`
9. Z-close: `POST /api/shifts/close` (fails if open tickets remain)

## Quartet (Track A)

1. `node scripts/quartet-smoke.mjs` â€” FB health 200 when dev server up
2. `node era-hotel-pms/scripts/test-pos-bridge.mjs` â€” bridge regression
3. KKM: pay returns `fiscal.driver` = `mock` (not stub flag)
4. Entitlement: pay without `platform_loyalty` in snapshot â†’ no promotion created in Orch (hooks gated)

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

