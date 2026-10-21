# Front Office — traceability (ElectraWeb FO spec)

> **Source spec:** absorbed from legacy `Electraweb/front office.md` (2026-06-04) — see [reference/ELECTRAWEB-SOURCE-INDEX.md](reference/ELECTRAWEB-SOURCE-INDEX.md)  
> **Last reviewed:** 2026-06-04 (Guest CRM)  
> **Legend:** **Done** = demo-ready per spec intent · **Partial** = UI/API exists, CSV/screens not fully matched · **Planned** = backlog

**Related:** [FRONT-OFFICE-ELECTRAWEB.md](./FRONT-OFFICE-ELECTRAWEB.md) · [GUEST-CRM-ELECTRAWEB.md](./GUEST-CRM-ELECTRAWEB.md) · [ELEKTRAWEB-PARITY.md](./ELEKTRAWEB-PARITY.md) · [UAT-SMOKE.md](./UAT-SMOKE.md) §14–16

---

## Summary

| Area | Done | Partial | Planned |
|------|------|---------|---------|
| Global header (satellites) | 1 | 0 | 0 |
| Left FO menu | 8 | 0 | 0 |
| Chessboard `/` | 9 | 0 | 0 |
| Reservation card | 10 | 0 | 0 |
| Room plan | 6 | 0 | 0 |
| In-house + guest card | 11 | 1 | 0 |
| **Total line items** | **45** | **1** | **0** |

**Product verdict:** FO **CSV parity** including Guest CRM P0+P1 and Reservation Details. **G6/G7 Done**; omnichannel STUB Partial. **R7 Done** (Wave D). Medical/finance via satellite deep links only.

**2026-10-15 desk rules:** before check-in the door can be cleared or a dirty in-service room can be reserved; check-in still requires clean or inspected. Cancel before arrival does not change housekeeping. Cancel asks for a reason; no-show does not. A cancelled stay can be restored onto a free type and door. Reservation list Hamısı excludes no-show and cancel. A manually posted room night (including a past Elektra night) locks that rate-grid row and does not close the hotel day; a medical rate posts the package lines for that night. Cancel reason is the CANCEL_NOTE on the stay. Front cash shows a cash-point department only when that tender moved money on the hotel business date. Empty department and tender rows stay hidden. Folio payments, deposits, and guest-debt payments land on the hotel drawer. A paid deferred check lands on F&B, clinic, or retail. Double-click a desk row opens that cell’s journal. Night-audit report 05 opens the same journal for the whole day. Departments are their own catalog, and a revenue code requires one. Night-audit switches live on hotel policies. 31 December closes the business day and leaves the date in place until Last Day of the Year. First Day of the Year opens 1 January before any posting on that date.

---

## 1. Global header (all industry satellites)

| # | Spec (`front office.md` L121–127) | Status | Implementation |
|---|-----------------------------------|--------|----------------|
| H1 | Right→left: Profile → Company → Bell → Locale | **Done** | `EraAppHeader` (D1) |
| H2 | Same on all satellites | **Done** | Wave A/B + D1 |

---

## 2. Left menu

| # | Spec item | Status | Route / notes |
|---|-----------|--------|---------------|
| M1–M9 | FO menu items | **Done** | See D1–D3 |

---

## 3. Chessboard `/` (L12–25)

| # | Spec item | Status | Notes |
|---|-----------|--------|-------|
| R1–R4, R6, R8–R9 | Rack UX | **Done** | D1–D3 |
| R5 | Цвет номера по HK | **Done** | `rackNumberTextClass` + `RACK_NUMBER_BY_HK` (Wave G) |
| R7 | Расширить фильтры | **Done** | Agency, source, pay, floor, multi room type, date/res/HK, inspected/OOO toggles (Wave D) |

---

## 4. Reservation card (L27–57, CSV)

| # | Spec block | Status | Notes |
|---|------------|--------|-------|
| C1–C10 | Full card CSV | **Done** | Wave E: left panel fields, room icons, attach, lightning, guests cols, pricing grid, folio 1st/2nd + cols, notes |

---

## 5. Room plan (L59–68)

| # | Spec item | Status | Notes |
|---|-----------|--------|-------|
| P1–P6 | Plan parity | **Done** | P4 aligned via `rackNumberTextClass` on room labels (Wave G) |

---

## 6. In-house (L71–72)

| # | Spec item | Status | Notes |
|---|-----------|--------|-------|
| I1–I2 | In-house | **Done** | D2 |

---

## 7. Guest card (L74–118, CSV)

| # | Spec block | Status | Notes |
|---|------------|--------|-------|
| G1, G4 | Stats + left identity | **Done** | |
| G2 | Toolbar | **Done** | Lock, menu, attach stub, copy, print (Wave F) |
| G3 | ID Reader | **Done** | Mock JSON paste modal (Wave F); no TWAIN |
| G5 | Identity grids | **Done** | Full document columns (Wave F) |
| G6 | CRM dashboard | **Done** | Config grid [`guest-crm-config.ts`](../src/lib/guest-crm-config.ts); P2/P3 disabled; clinic/finance satellites |
| G7 | Reservation details | **Done** | Deep links + family/accompanying/booker/analytics; Res-H4 deferred buttons disabled |
| G8 | Details tab | **Done** | marriageDate, bonus %, verification, accounting stub (Wave F) |
| G9 | Loyalty | **Done** | Cards + points history API/grid (Wave F) |
| G10 | Time share | **Done** | Quotation/Agreement/Cancel/All tabs (Wave F) |

---

## 8. Planned backlog (deferred)

| ID | Item | Status after E–G |
|----|------|------------------|
| B1 | Passport hardware scanner | **Done (mock)** | JSON ID reader modal |
| B2 | CRM 50+ buttons | **Done (P0–P1)** | P2/P3 visible-disabled per [GUEST-CRM-ELECTRAWEB.md](./GUEST-CRM-ELECTRAWEB.md) |
| B9 | CRM omnichannel | **Done (platform notify)** + **Partial (vendor STUB)** | WhatsApp/email/SMS via `trySendPlatformNotification`; Twilio/SendGrid not wired |
| B3–B8 | Reservation/guest/rack tails | **Done** | Waves E–G |
| B10 | External ERP webhook (`EXTERNAL_INTEGRATION_URL`, Settings → Integration) | **Off by default — rework needed** | Kept for customers with their own accounting. Before use: one document per day instead of per-charge posts, numeric revenue code + system role in payloads, per-org URL/secret, retry for folio events — [22-outbound-integration-policy.md](./clone-spec/22-outbound-integration-policy.md) |
| B11 | Nafta test data cleanup | **Open** | 11 test hotel invoices sent to finance before the cutover (finance skipped them: no counterparty VÖEN; processed-event marks stay). Remove the test invoices in the hotel before go-live |

---

## 9. How to update this table

1. Change code → update row status here in same PR.
2. UAT: [UAT-SMOKE.md](./UAT-SMOKE.md) §14–15.
3. i18n: `apply-wave-e-res-card-i18n.mjs` · `apply-wave-f-guest-i18n.mjs` · `apply-guest-crm-i18n.mjs`.
4. Migrate: `npx prisma migrate deploy` (includes `20260604120000_guest_crm`).

---

## 10. 2026-10-08 FO ops (not a sell claim)

- Reservation card: CANCELLED before arrival, NO_SHOW from the arrival date, while status is CONFIRMED or OPTION. Night audit is unchanged.
- A door move is one command (`requestRoomMove`): the reservation card Save, drag-and-drop, the reservation card date form, and `POST /api/reservations/:id/relocate`. A free clean door moves immediately. A future date, or a door that is still occupied or not Clean/Inspected, stays a PENDING plan with the user who asked. The guest and the night charge stay on the current door until that target door is marked Clean or Inspected, including from a housekeeping task or visit outcome. A class change asks who pays before the move; the choice is stored on the plan. `POST /api/reservations/:id/stay-split` without a room still pins a type quota.
- Room status changes (out of order, return to service, housekeeping condition) are written to the satellite audit log with the user.
- Walk-in profile is lookup kind `WALKIN_PROFILE` on `Reservation.walkInProfileCode`. Saving WALKIN clears `agencyId`.
- Rate plans can be deleted when no reservation, contract, or stay slice references them.
- Policies save creates a hotel profile when the row is missing.
- Reservations grid: full note of the selected row, birthday icon inside the stay window, server sort. Apply migration `20261008230000_walkin_profile_stay_slice_room`.
- Reservation-card stay journal is `SatelliteAuditLog` for that stay: event list + labeled expand (create/save, check-in/out, room, folio, night audit, Elektraweb). Not a second table.
- Kit column sort on the FO and front-cash lists (groups, laundry, room changes, reservation times, agency inbox, folio journal, agency and company ledgers). In-house and folio balances open sorted by room number. Groups, room changes, agency inbox, in-house, the folio journal, and both city ledgers also filter by the columns that were previously only searchable as one box.
- Reservation card footer shows CANCEL and NO SHOW to the left of check-in. Credit card, packages, tasks, and folio routing stay inactive until the stay is saved. Notes render as bold title plus text, and only when a note exists. The room-change form opens from a checkbox. A new stay starts at 0 adults.
- Reservations list keeps the selected stay's notes in a fixed band between the filters and the grid.
- Guest citizenship is hotel lookup kind `NATIONALITY` (ISO countries, az/ru/en labels). The guest list filter uses the same lookup. Apply migration `20261009120000_nationality_lookup`. Birth date accepts eight digits (`08071984` → `08.07.1984`).
- Night audit asks F&B `GET /api/internal/v1/shifts/open` with the hotel's organization (`x-era-organization-id`) and the bridge secret. F&B lists open shifts for that organization only. There is no fallback to the container's organization. An empty answer closes that organization's hotel copies whose shift id is missing from the list. Another cafe's copy does not block this hotel. A shift ping from F&B must send the cafe's organization; the hotel stores the copy under that id and rejects a ping without it.
- A clinic episode opens on check-in. Saving a reservation that has not checked in does not publish a clinic booking. Package changes after check-in update the open course.
- Check-in while the business date is behind the arrival date (and the arrival date is already today on the wall calendar) tells the cashier which business date night audit is still on. Early check-in stays for an arrival that is still in the future.
- Check-in marks the occupied in-service door Dirty. A room move with a reception reason on the arrival day, before any folio charge, puts the vacated door back to Clean. A later move leaves that door Dirty and opens a housekeeping task. The door the guest walks into is Dirty.

## 11. 2026-10-13 stay billing and packages (not a sell claim)

ADR: [hotel-stay-amendment-and-pricing.md](../../docs/adr/hotel-stay-amendment-and-pricing.md). UAT: [UAT-SMOKE.md](./UAT-SMOKE.md) §35 steps 6–9 and §38. Not SHIPPED until §35 is signed. Apply `20261013010000_stay_billing_and_tariff_log`.

- Reservation card Rate & source has Stay billing: Normal, Compliment (room nights 0, extras billed), House use (room nights 0, each positive folio charge offset so the guest balance stays 0). Meal plan is not this field.
- A rate-plan change on the card or in the product wizard appends `StayTariffChange`. The stay journal shows it next to room moves. Posted nights are not rewritten.
- Medical Rates (`MEDICAL RATES` / Standart / Premium / Derma / Detoks) keep the guest package column (those four SKUs only). An empty package blocks save and check-in. The tariff code is not copied into that column. Infotur (`PKG-INFOTUR`) and `WALKIN` hide the column; Infotur prices from its own sell grid and does not open a clinic episode.
- Clinic hears a guest at check-in, and again when that guest's package changes on an in-house stay (card save or the product wizard). Saving a reservation that is not yet in house does not open an episode. The agency name Walk-in Leisure does not mute clinic on the desk. The Elektra bridge still treats that label as non-medical when the imported tariff is not a medical `PKG-*` SKU (Infotur does not count).
- Check-in of a past arrival moves `checkInDate` to the open business date and drops nights before that date. The confirmation names the new date only then. `/settings/daily-prices` opens on `WALKIN`; `DAILY RATES` stays in the filter.

## 12. 2026-10-21 room plan, folio, company city ledger (not a sell claim)

- Room plan: single click highlights a bar. Double-click opens the card. A tooltip waits 400 ms and cancels on leave or drag. Every visible bar drags, including a stay that has a slice. The middle moves the room and, before arrival, the whole interval by whole nights, including a drop on the same row. The left edge moves arrival and the right edge moves departure (minimum one night). In-house arrival does not move. Pulling an in-house departure earlier opens the early-checkout confirmation. A diagonal drop changes dates first (`PATCH /schedule` without `roomId`), then the existing relocate command. Unassigned chips drag onto a row: the column is the new arrival and the length stays. A ghost snaps to whole days. A drag does not open the card.
- Folio: article chips are the articles on the stay plus All (no article label). Search and a charges/payments/all toggle. Guest, agency, and company chips show only when that pocket has a line; All stays. The grid fills the tab; totals and actions stay pinned. The footer sums the filtered charges, payments, and net. Print uses that same set. Folio and pricing rows are numbered and use tighter padding. The folio date column is the charge business date or the payment posting time. Adjustment is its own modal and writes a counter-line; the original charge stays. An adjusted row can print the stored slip. Early check-in, early check-out, and a room-type mismatch confirm in modals.
- Company city ledger uses the same gate as the agency path. `CL_COMPANY` does not post until the gate passes. A transferred company folio dispatches `SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT` with `companyId`. Apply `20261021180000_folio_charge_adjustment`.
