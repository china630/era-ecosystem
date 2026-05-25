# UAT smoke — era-fb-pos

## FB-0 — Scaffold

- [x] `GET /api/health` → 200
- [x] Home / floor pages load
- [x] Prisma Ticket model + `POST /api/tickets`
- [x] Room charge bridge: `POST /api/tickets/{id}/room-charge`

## FB-1 — MVP Nafta

1. `POST /api/shifts/open` `{ "outletCode": "RESTAURANT", "openingCash": 100 }`
2. `GET /api/tables` — pick a table id
3. `POST /api/tickets` `{ "tableId": "...", "lines": [{ "description": "Soup", "qty": 2, "unitPriceAzn": 8 }] }`
4. `POST /api/tickets/{id}/fire` — lines → FIRED
5. `GET /api/kds/lines` — queue visible; `PATCH /api/kds/lines/{lineId}` `{ "kitchenStatus": "DONE" }`
6. Cash pay: `POST /api/tickets/{id}/pay` `{ "method": "CASH" }` → ticket CLOSED, table FREE
7. Room charge (with hotel-pms running, or `FB_POS_PMS_STUB=1`):
   - `GET /api/in-house?query=201`
   - `PATCH /api/tickets/{id}` `{ "roomChargeReservationId": "<uuid-or-room>" }`
   - `POST /api/tickets/{id}/room-charge`
8. Void: open new ticket + line → `POST /api/tickets/{id}/lines/{lineId}/void` `{ "reason": "wrong item" }`
9. Z-close: `POST /api/shifts/close` (fails if open tickets remain)

## Pass criteria

- `npm run build` succeeds
- Flows 1–9 complete without blocking errors
- With `HOTEL_PMS_URL` set, room charge appears on PMS folio (see [era-hotel-pms UAT §11](../../era-hotel-pms/doc/UAT-SMOKE.md))
