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

1. `/bookings/new` — create guest via **+ New guest**; enter FIN/passport in lookup fields → MDM link → verify guest row has `globalPersonId` and **no** local FIN/passport columns (DB).
2. `/guests` — open guest card; Details tab shows **masked** FIN/passport from MDM ops-profile; edit uses transient lookup only.
3. Create 3-night booking (room type + rate + dates).
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

### 6b. Settlement hub (pending walk-in)

1. With Nafta org policy (`settlementHub=HOTEL_FRONT_CASH`): fb-pos walk-in ticket → **Send to reception**.
2. `/front-cash/pending` — row appears; pay CASH → mock fiscal; fb ticket CLOSED via callback.
3. Clinic walk-in visit complete → pending row; pay at Front Cash → visit `settledAt` set.
4. Leave a pending row open → night audit **blocks** (default `pendingSettlementNaPolicy=BLOCK`); after pay → NA succeeds.

## 7. Channel (CH-01, CH-02)

1. `/channel` — **Channel mappings**: add channel (code + name); map room type → OTA room code; map rate plan → OTA rate code.
2. `/channel` — stop sell tomorrow (all types).
3. Try booking overlapping date — no availability.
4. Remove stop sell; log/resolve sync error.
5. Open reservation from room rack → `/reservations/{id}` full-page card with back link to `/`.

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

## 15. BANQUET BEO / MICE (Stage 21 / HN-8 / H-BL-31)

1. `/banquets` as `manager` — seed shows DRAFT BEO for **NAFTANI-HALL**.
2. Open event detail `/banquets/{id}` — add **AV equipment** order line; tab **Staff** — add waiter assignment.
3. **Confirm** — hall blocked on POS calendar; package total on master/company folio; deposit posted if configured.
4. `/banquets/calendar` — resource booking visible for event date.
5. `cd era-fnb-pos && npm run dev` — open shift on outlet `BANQUET`.
6. `POST http://localhost:3200/api/tickets` with `{ "outletCode": "BANQUET", "beoId": "<event-id>", "guestName": "Corporate dinner" }`.
7. Add **extras** line only (base package already on PMS folio); `/banquets/reports/profitability` shows planned vs actual.

## 16. GL-BRIDGE (Stage 22 / NW-1 FIN-01)

1. `/admin/integration` � revenue ? GL mapping table (ROOM?601, FOOD?602, �).
2. `PUT /api/master/revenue-gl-mappings` with `{ "revenueCodeId", "glAccountCode" }`.
3. Run night audit on `/operations` � outbound journal shows `NIGHT_AUDIT_CLOSED` with mapped lines.
4. With `ERA_EVENT_GATEWAY_MODE=orchestrator`, finance worker posts multi-line NAS journal (`SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED`).

## 17. INVOICE-AGENCY (Stage 23 / NW-2)

1. `/reports/invoices` � list fiscal documents; toggle **Integrate to accounting**.
2. Issue invoice from folio � row appears with status SENT.
3. `/reports/agency-ledger` � summary table: city ledger, cash paid, net amount per agency (PROC-21).

## 18. B2B SALES CONTRACTS (Stage 24 / NW-3 PROC-24 / H-BL-30)

1. `/admin/contracts` — create ACTIVE contract for TRAVEL-AZ with DERIVED −10% plan + 20 room-night allotment on STANDARD.
2. `GET /api/admin/contracts/{id}?utilization=1` — utilization metrics after bookings.
3. New reservation with `salesContractId` — contract rate plan applied; BAR allotment not offered when contract quota exhausted.
4. `/reports/agency-profitability` — contract-sourced revenue visible.
5. Legacy `/admin/contract-pricing` redirects to `/admin/contracts`; run `npx tsx prisma/scripts/migrate-contract-pricing-to-derived.ts` for CPR migration.

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

## 14. Wave D1/D2 — ElectraWeb parity (2026-06-02)

Prerequisite: `cd era-hotel-pms && npx prisma migrate deploy` (applies `20260602120000_wave_d2_guest_res_submodals`).

1. Header (logged in): right cluster order **Locale → Bell → Organization → Profile** (read RTL: Profile … Locale).
2. `/` rack aside: filters **Agency**, **Source**, **Payment status**; reset clears all.
3. Open reservation from list → **Guests** tab full pax grid; **Pricing** manual rate + daily grid; **Folio** posting/payment links.
4. Reservation bottom bar: **Credit card**, **Packages**, **Tasks**, **Folio routing** open modals (not disabled).
5. `/in-house` → guest card → **Identity**: add document; toggle SMS/WhatsApp/phone/email consents → Save.
6. Guest card **Details** tab: visa/marital/parents fields → Save → reload persists.
7. **Loyalty** / **Time share** tabs: add row via + button.
8. CRM **Notes** / **Tasks** links → `/guests/:id/notes` and `/guests/:id/tasks`.
9. `/reports/group-reservations` → **Add group** modal; click guest name → reservation card opens.
10. Locale **AZ**: rack legend shows Boş/Dolu/Gəliş (not English-only labels).

## 15. Waves E–G closure (2026-06-03)

Prerequisite: `cd era-hotel-pms && npx prisma migrate deploy` (applies `20260603120000_wave_e_reservation_csv`, `20260603130000_wave_f_guest_csv`).

1. Reservation card: left panel **Nights**, **Preferred location/bed**, **Given room type**, **Contract ref** → Save → reload.
2. Room row: **Lock**, **Search** (focuses room select), **HK** link, **Bed** icon visible.
3. Toolbar **Attach** → upload file metadata row; **Lightning** → recalc / charge-all shortcuts.
4. **Guests** tab: member/pay/res id columns; **Repeat guest** adds pax row.
5. **Pricing** tab: currency, fix price, discount % columns on daily grid.
6. **Folio** tab: **1st / 2nd person** filters; columns Pax, Invoice.
7. Guest card **ID Reader** → paste JSON `{"firstName":"Test","lastName":"User"}` → Apply → fields update.
8. Guest **Loyalty** → points history grid → add row.
9. Guest **Time share** → switch Quotation / Agreement / Cancel / All tabs.
10. Rack + room plan: room numbers use HK-colored text (compare vacant vs dirty rooms).

## 16. Guest CRM + Reservation details (2026-06-04)

Prerequisite: `npx prisma migrate deploy` (includes `20260604120000_guest_crm`); `node scripts/apply-guest-crm-i18n.mjs`.

1. In-house → open guest card → tab **CRM**: enabled links **Tasks**, **Notes**, **Tags** (blue buttons).
2. **Allergens** → add allergen → guest card left panel shows allergen warning badge.
3. **Document archive** → upload a file → row appears in list.
4. Tab **Reservation details** → **Reservations** opens `/reports/reservations?guestId=…` filtered list.
5. **Transfers** opens `/transfers?guestId=…`; **Lost & found** opens HK list with guest filter.
6. Medical buttons: if `NEXT_PUBLIC_CLINIC_WEB_URL` set → external link; else disabled with tooltip.
7. **Comments** → add comment → listed on guest comments page.

## 22. Nafta W0 — analytics, child pricing, OTA (2026-06-13)

1. `/admin/child-matrix` — ensure row 0–6 = 100% discount; create reservation with `children5_2=1` → **Pricing recalc** → nightly total unchanged vs adult-only baseline.
2. `/reports/analytics` — set date range → booking sources, cancellations, nationality tables load.
3. OTA webhook (with `ERA_OTA_WEBHOOK_SECRET` if set):
   ```bash
   curl -X POST http://127.0.0.1:3201/api/integrations/ota/booking \
     -H "Content-Type: application/json" \
     -H "x-era-ota-secret: $ERA_OTA_WEBHOOK_SECRET" \
     -d '{"event":"create","externalReservationId":"ota-test-001","payload":{"guest":{"fullName":"OTA Test"},"checkInDate":"2026-07-01","checkOutDate":"2026-07-03","otaRoomCode":"STD","totalAmount":200}}'
   ```
4. Channel manager: `POST /api/channel/sync/push` with session → `{ ok: true, adapter: "webhook" }`.
5. Finance: set employee `contractEndDate` = today+7, `ERA_NOTIFICATIONS_PACK=true` → HR cron fires at 08:00 Baku (or invoke service in dev).

## 21. ELEKTRAWEB-IMPORT (Stage 26 / platform super-admin)

**Guide:** [ELEKTRAWEB-IMPORT.md](./ELEKTRAWEB-IMPORT.md)

1. Log in with email from `PLATFORM_SUPER_ADMIN_EMAILS` (not local `admin` unless listed).
2. Open **Setup → Elektraweb import** (`/admin/import`).
3. Phase 1: preview then import one dictionary file (e.g. Bed Type.xlsx) — expect created/updated counts, zero blocking errors.
4. Phase 2: import Room Types before Rooms; preview Rooms — no "room type not found" if step 20 done.
5. Confirm progress checkmarks persist after page reload (localStorage).
6. Local hotel user (`admin` / `reception`) must **not** see import nav or API (403 on `POST /api/import/room-types`).
7. Verify imported rows on `/admin/master-data` (no Import buttons on that screen).

## 23. Nafta P2 — H-BL backlog (2026-06-14)

1. **BAR pricing:** run `npx tsx prisma/scripts/seed-bar-from-legacy.ts` → `/admin/bar-calendar` shows rates → booking recalc matches BAR cell total.
2. **Night audit:** NA posts room charge from daily rate / BAR (not flat `pricePerNight`); `/operations` shows business date vs wall clock.
3. **Credit limit:** set `HotelProfile.defaultCreditLimitAzn=500` → fb-pos room-charge over limit returns `CREDIT_LIMIT`.
4. **Meal gate:** BB guest zero-post ticket → 201; RO guest zero-post → 403 `MEAL_NOT_INCLUDED`.
5. **Deposits:** `POST /api/reservations/{id}/deposits` HELD → check-in applies payment to folio.
6. **Split settlement:** `/folio/{id}` → add CASH + CARD lines → Complete settlement → balance 0.
7. **Guest dedup:** `/reports/guest-dedup` summary loads; see `doc/NAFTA-GUEST-INTELLIGENCE.md`.
8. **Omnichannel:** guest card send SMS/WA with CP env → `GuestCommunication.status=SENT`.

## 24. Nafta P3 — H-BL-20…28 (2026-06-14)

1. **H-BL-28:** clinic `/admin/procedure-rules` — add FORBID_SAME_DAY rule → hotel `/procedures` book rejects conflict.
2. **H-BL-26:** Guest card CRM — interests/social/general CRM pages; see `doc/GUEST-CRM-ELECTRAWEB.md`.
3. **H-BL-27:** Folio split settlement shows loyalty balance; `LOYALTY_POINTS` line burns CP ledger.
4. **H-BL-25:** `ERA_CHANNEL_ADAPTER=booking_com` + env → channel push includes BAR price.
5. **H-BL-23:** `POST /api/migration/{id}/submit` → mock `externalRef` on registration.
6. **H-BL-24:** Fiscal doc shows `eqaimeId` / status when set.
7. **H-BL-20:** `/concierge` catalog + order complete posts folio charge.
8. **H-BL-21:** `POST /api/integrations/minibar-sensor` with `x-minibar-secret` → auto minibar post.
9. **H-BL-22:** `/dispatch` queue + assign vehicle.

## 25. Nafta P0/P1 — ops UI smoke (2026-06-14)

UI paths (no curl) for [NAFTA_DOC_API_UI_AUDIT](../../docs/NAFTA_DOC_API_UI_AUDIT.md) closure:

1. **Migration:** `/migration` → Prefill + Submit to registry on a registration row.
2. **Folio card:** open reservation → Folio tab → Place card hold / Release; Billing → credit limit; early/late preview under check-in/out times.
3. **Channel:** `/channel` → **Push OTA** / **Pull OTA**; confirm last sync message.
4. **Admin:** `/admin/yield-rules` CRUD; `/admin/audit` filter by entity type + date range.

## Pass criteria

- `npm run build` succeeds.
- No blocking errors in flows 1–11 and §20.
- Outbound journal reflects folio ops when channels enabled.

## 26. Platform catalog gateway (Wave 2 — no finance-core for FX/VÖEN)

Prerequisite: orchestrator API `:4000` + data-hub `:4200` running; **finance-core stopped** (sanatorium-autonomous smoke).

1. **FX badge:** `/admin/master-data` → rate plan in **USD** → booking/folio shows AZN equivalent via `FxEquivalentBadge` (`GET /api/fx-preview` → orchestrator catalog).
2. **Travel agency VÖEN:** `/admin/travel-agencies` (or counterparty form with VÖEN field) → lookup returns company name without finance API up.
3. **Auto-BAR calendar:** `/admin/bar-calendar` loads; non-working days respected (orchestrator calendar proxy + Sat/Sun fallback if hub down).

