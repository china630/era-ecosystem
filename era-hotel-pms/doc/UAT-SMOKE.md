# UAT smoke test — ERA Hotel PMS (Phase 1)






## SSO paths (platform entry � v1.0)

### Owner path (Orchestrator)
1. Login at Orchestrator web: `http://localhost:3000` ([QUARTET_UAT.md](../../docs/QUARTET_UAT.md)).
2. Home → industry tile → **Open** → satellite `/sso/callback` session.
3. Smoke: `node scripts/sso-launch-smoke.mjs` (`ERA_SSO_SHARED_SECRET` aligned).

### Ops path (local)
1. Use this app's `/login` and seed users in sections below.
2. Billing, team, register → Orchestrator only (no satellite `/register`).



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

1. `/bookings/new` — create guest via **+ New guest**; optional **FIN (MDM lookup)** → `globalPersonId` on guest.
2. Create 3-night booking (room type + rate + dates).
3. Confirm reservation on chessboard.

## 3. Check-in & folio (PMS-03, FIN-01)

1. Assign room (INSPECTED/CLEAN), check-in.
2. `/folio/[reservationId]` � post charge (ROOM or FOOD).
3. Post cash payment 50 AZN.
4. As `manager` � void one charge (FIN-03).

## 4. Outbound events (Stage 10)

1. Sign in as `admin`.
2. `/admin/integration` � all realtime channels ON; URL = mock-receiver.
3. Repeat charge/payment/void on folio.
4. Journal shows `FOLIO_*` rows (SENT or SKIPPED).
5. Toggle `chargePosted` OFF, post charge � status `SKIPPED`.

## 5. Check-out

1. Balance folio to zero, check-out.
2. Journal: `RESERVATION_COMPLETED`.

## 6. Cash & night audit (FIN-05, NA-01)

1. `/operations` � open cash shift.
2. Run night audit � must fail with message.
3. Close shift, run night audit � steps list + COMPLETED.
4. Journal: `NIGHT_AUDIT_CLOSED`.

## 7. Channel (CH-01, CH-02)

1. `/channel` � stop sell tomorrow (all types).
2. Try booking overlapping date � no availability.
3. Remove stop sell; log/resolve sync error.

## 8. Master data (MD-01�04)

1. `/admin/master-data` � add room type, assign room type, add rate plan, add revenue code.

## 9. Room plan & occupancy (PMS-04, PMS-06)

Room plan UI (Wave C+):

- [ ] Room numbers stay in the **left column** while scrolling dates
- [ ] Bars show **arrow tip** on the last night; **notched start** when checkout = next check-in (e.g. room 203 chain)
- [ ] Hover a bar → tooltip with res no., guest, dates, agency, payment
- [ ] Table uses **full content width**; row height compact (~36px)

1. `/room-plan` � extend +1 night on bar.
2. `/reports/occupancy` � 30-day grid loads.

## 10. Housekeeping & medical

1. `/housekeeping` � complete task, set OOO.
2. `/medical` � alert + procedure to folio (Doctor login if needed).

## 12. SAN-PKG � medical package EOD (Stage 18)

1. Seed guest **Ali Mammadov** in-house on rate **MEDICAL** (room 201).
2. `/folio/[reservationId]` � no upfront ROOM bundle at check-in (medical defer).
3. `/operations` � close shifts, run night audit.
4. Folio shows package lines (ROOM 90 + TREATMENT 60 + BOARD 30) for business date.

## 13. PROC-SCHED (Stage 19)

1. `/procedures` � book MASSAGE for in-house guest (seed has BOOKED slot).
2. **Finish** included MASSAGE � audit note only, no extra MEDICAL charge.
3. Book **MUD** (not in package), finish � MEDICAL charge on folio.

## 14. TRANSFER (Stage 20 / HN-7)

1. `/transfers` � seed shows CONFIRMED IN transfer for **Ali Mammadov** (flight J2-812, VAN-01).
2. Book OUT transfer for in-house guest � status BOOKED.
3. Assign vehicle � status CONFIRMED.
4. **Complete** � `TRANSFER` charge on guest folio; order status DONE.

## 15. BANQUET BEO (Stage 21 / HN-8)

1. `/banquets` as `manager` � seed shows DRAFT BEO for **NAFTANI-HALL**.
2. **Confirm** � hall blocked on POS calendar; deposit 500 AZN posted to company guest folio (room 101).
3. `cd era-fnb-pos && npm run dev` � open shift on outlet `BANQUET`.
4. `POST http://localhost:3200/api/tickets` with `{ "outletCode": "BANQUET", "beoId": "<event-id>", "guestName": "Corporate dinner" }`.
5. Add extras line; optional room charge to in-house guest folio.

## 16. GL-BRIDGE (Stage 22 / NW-1 FIN-01)

1. `/admin/integration` � revenue ? GL mapping table (ROOM?601, FOOD?602, �).
2. `PUT /api/master/revenue-gl-mappings` with `{ "revenueCodeId", "glAccountCode" }`.
3. Run night audit on `/operations` � outbound journal shows `NIGHT_AUDIT_CLOSED` with mapped lines.
4. With `ERA_EVENT_GATEWAY_MODE=orchestrator`, finance worker posts multi-line NAS journal (`SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED`).

## 17. INVOICE-AGENCY (Stage 23 / NW-2)

1. `/reports/invoices` � list fiscal documents; toggle **Integrate to accounting**.
2. Issue invoice from folio � row appears with status SENT.
3. `/reports/agency-ledger` � summary table: city ledger, cash paid, net amount per agency (PROC-21).

## 18. CONTRACT-PRICING (Stage 24 / NW-3 PROC-24)

1. `/admin/contract-pricing` � seed rule: TRAVEL-AZ ?10% on STANDARD rate.
2. `GET /api/bookings/quote?ratePlanId=�&checkInDate=�&checkOutDate=�&agencyId=�` � adjusted nightly.
3. New booking with agency � `totalAmount` reflects contract discount.

## 19. CHANNEL stop-sell regression (NW-4 / PROC-23)

1. `/channel` � create stop-sell for room type + date; availability returns 0 for that type/range.
2. Delete stop-sell � availability restores.

## 11. FB-POS bridge (Stage 17 / SP3)

Requires `era-fnb-pos` on :3200 and matching `POS_BRIDGE_SECRET` on both apps.

1. Check in a guest to room **201** (or use seed in-house guest).
2. From host: `node scripts/test-pos-bridge.mjs` � in-house lookup + idempotent room-charge + shift status.
3. Start fb-pos: `cd era-fnb-pos && npm run dev` (set `HOTEL_PMS_URL=http://127.0.0.1:3000`).
4. `POST http://localhost:3200/api/shifts/open` with `{ "outletCode": "RESTAURANT" }`.
5. Create ticket + `POST .../fire` + mark KDS DONE; `PATCH` ticket with `roomNumber: "201"`.
6. `POST http://localhost:3200/api/tickets/{id}/room-charge` � expect **201** from PMS.
7. PMS folio for room 201 shows FOOD charge; `GET /api/pms/room-charges?externalTicketId={ticketId}` returns row.
8. `POST .../api/shifts/close` on fb-pos � night audit on `/operations` must **not** block on POS shift.

## 20. Platform notify + outbound (Wave B4)

1. Set `CONTROL_PLANE_URL`, `ERA_SATELLITE_ORGANIZATION_ID`, service token on hotel-pms.
2. Issue invoice from folio � guest with phone receives `hotel.invoice.issued` (best-effort WA).
3. `SATELLITE_HOTEL_INVOICE_ISSUED` reaches orchestrator; Finance creates draft invoice.
4. Outbound journal: post charge ? `FOLIO_CHARGE_POSTED` when enabled in `/admin/integration`.

## Quartet (Track A/B)

1. `node ../../scripts/quartet-smoke.mjs` � hotel health
2. `node scripts/test-pos-bridge.mjs` � �11 bridge regression
3. `/admin/integration` � platform subscription block visible when Orch configured
4. Folio invoice � hooks gated by entitlement (`runPlatformCommerceHooks`)

See [QUARTET_UAT.md](../../docs/QUARTET_UAT.md).

## 12. Wave B — Front Office parity (2026-06-01)

Prerequisite: `npx prisma migrate deploy` (includes `20260601120000_wave_b_full`).

1. Open `/` → click occupied/vacant room → **Reservation Card** opens.
2. **Pricing tab:** **Calculate daily prices** → grid of nights; **Charge all** → ROOM lines on folio (no duplicate for same night).
3. Create booking from list **Add** → card stays open after save (`onCreated`).
4. `/reports/reservations/notes` redirects to list with `?hasNotes=1`; **Edit** opens card Notes tab.
5. `/reports/inhouse-daily` — pick date, in-house + departures grids.
6. `/reports/end-of-day-logs` — after `/operations` night audit, runs listed.
7. `/channel` — availability matrix for date range.
8. `/housekeeping/closed-rooms` — OOO/OOS rooms (not parity stub).
9. `/guests` → open **Guest card** → Identity tab → add document.

## 13. Wave C — Front Office product (2026-06-01)

Prerequisite: `docker compose build --no-cache hotel-pms && docker compose up -d hotel-pms`; logs show `[migrate] database is up to date`. Hard refresh `http://localhost:3201` (Ctrl+F5).

### Navigation & Əsas
1. Core menu order: **Əsas** → Şahmatka → Plan → List → Group → In-house → EOD logs → Room changes → Daily inhouse → Operations.
2. No **FO with notes** in Core; no **New booking** in header.
3. `/bookings/new` redirects to `/?openReservation=1`.
4. `/executive` (manager/admin): seven KPI cards (occupancy %, in-house, arrivals/departures, revenue, AR, ADR, RevPAR).
5. Reports section: **Actual check-in/out times** → `/reports/reservation-times` (not in Core).

### Room rack & plan
6. Rack tile shows: status, guest name, stay dates, pay badge, procedure count.
7. Drag in-house/confirmed reservation to another room → confirm → room updates (HK-03 enforced).
8. `/room-plan`: **Grouping** and **Period** dropdowns (14/21/30); drag bar to another room row.

### Lists & cards
9. `/reports/reservations`: notes column, amber rows with notes, filter **With notes**; `/reports/reservations/notes` → `?hasNotes=1`.
10. **+** on vacant rack tile opens reservation create with `roomId`; create/edit share toolbar + bottom bar chrome.
11. Guest card: stats bar, CRM + Reservation Details button grids (not three links only).

## Pass criteria

- `npm run build` succeeds.
- No blocking errors in flows 1�11 and �20.
- Outbound journal reflects folio ops when channels enabled.

