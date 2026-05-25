# UAT smoke test — ERA Hotel PMS (Phase 1)

Run after `docker compose up -d`, `npx prisma migrate deploy`, `npm run db:seed`, `npm run dev`.

## Logins (seed)

| User | Password | Role |
|------|----------|------|
| admin | admin123 | Hotel_Admin |
| reception | reception123 | Receptionist |
| manager | manager123 | Manager |

## 1. Auth & navigation

1. Open `/login`, sign in as `reception` / `reception123`.
2. Confirm Chessboard loads; AppNav shows allowed links only.

## 2. Booking (PMS-01)

1. `/bookings/new` — create guest via **+ New guest**.
2. Create 3-night booking (room type + rate + dates).
3. Confirm reservation on chessboard.

## 3. Check-in & folio (PMS-03, FIN-01)

1. Assign room (INSPECTED/CLEAN), check-in.
2. `/folio/[reservationId]` — post charge (ROOM or FOOD).
3. Post cash payment 50 AZN.
4. As `manager` — void one charge (FIN-03).

## 4. Outbound events (Stage 10)

1. Sign in as `admin`.
2. `/admin/integration` — all realtime channels ON; URL = mock-receiver.
3. Repeat charge/payment/void on folio.
4. Journal shows `FOLIO_*` rows (SENT or SKIPPED).
5. Toggle `chargePosted` OFF, post charge — status `SKIPPED`.

## 5. Check-out

1. Balance folio to zero, check-out.
2. Journal: `RESERVATION_COMPLETED`.

## 6. Cash & night audit (FIN-05, NA-01)

1. `/operations` — open cash shift.
2. Run night audit — must fail with message.
3. Close shift, run night audit — steps list + COMPLETED.
4. Journal: `NIGHT_AUDIT_CLOSED`.

## 7. Channel (CH-01, CH-02)

1. `/channel` — stop sell tomorrow (all types).
2. Try booking overlapping date — no availability.
3. Remove stop sell; log/resolve sync error.

## 8. Master data (MD-01–04)

1. `/admin/master-data` — add room type, assign room type, add rate plan, add revenue code.

## 9. Room plan & occupancy (PMS-04, PMS-06)

1. `/room-plan` — extend +1 night on bar.
2. `/reports/occupancy` — 30-day grid loads.

## 10. Housekeeping & medical

1. `/housekeeping` — complete task, set OOO.
2. `/medical` — alert + procedure to folio (Doctor login if needed).

## 11. FB-POS bridge (Stage 17 / SP3)

Requires `era-fb-pos` on :3200 and matching `POS_BRIDGE_SECRET` on both apps.

1. Check in a guest to room **201** (or use seed in-house guest).
2. From host: `node scripts/test-pos-bridge.mjs` — in-house lookup + idempotent room-charge + shift status.
3. Start fb-pos: `cd era-fb-pos && npm run dev` (set `HOTEL_PMS_URL=http://127.0.0.1:3000`).
4. `POST http://localhost:3200/api/shifts/open` with `{ "outletCode": "RESTAURANT" }`.
5. Create ticket + `POST .../fire` + mark KDS DONE; `PATCH` ticket with `roomNumber: "201"`.
6. `POST http://localhost:3200/api/tickets/{id}/room-charge` — expect **201** from PMS.
7. PMS folio for room 201 shows FOOD charge; `GET /api/pms/room-charges?externalTicketId={ticketId}` returns row.
8. `POST .../api/shifts/close` on fb-pos — night audit on `/operations` must **not** block on POS shift.

## Pass criteria

- `npm run build` succeeds.
- No blocking errors in flows 1–11.
- Outbound journal reflects folio ops when channels enabled.
