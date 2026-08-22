# Housekeeping — Nafta operational spec

**Status:** Waves 0–3 **coded** (2026-08-22) — not SHIPPED / not Pilot until UAT-SMOKE HK UI sign-off.  
**ADR:** [`docs/adr/hotel-housekeeping-nafta-ops.md`](../../docs/adr/hotel-housekeeping-nafta-ops.md)  
**Acceptance:** declared in [`Hotel-Acceptance-System.md`](../../docs/acceptance/Hotel-Acceptance-System.md) — do not treat as Pilot-ready or edition `ga`.  
**Scaffold today:** `AC-HOT-HK` (DIRTY not assignable; CLEAN → INSPECTED). That is not this spec.

Paper / export sources (2026-08):

- Weekly duty roster (Mərtəbə / Meydan / Çamaşırxana, 04.05.26–10.05.26).
- Elektraweb export `Kat Hizmetleri Raporları.2026-08-22.12-06-57.Nafta Sanatorium Hotel.xlsx` (floor 4, 24 columns).
- Guest laundry / pressing price ticket (NAFTA, az/en/ru).
- Elektra PDF floor list `Отчеты По Уборке Номеров` (22.08.2026, floor 7).

---

## 1. Current product vs this spec

| Area | Scaffold now | This spec |
|------|----------------|-----------|
| Screens | `/hk`, `/hk/mobile`, `/hk/minibar`, `/hk/maids`, `/hk/closed-rooms`, `/hk/lost-and-found` | + roster, daily rotation, forecast, guest laundry ticket |
| Room state | One `RoomStatus` (AVAILABLE / OCCUPIED / DIRTY / CLEAN / INSPECTED / OOO / OOS / MAINTENANCE) | Three axes (inventory × FO occupancy × HK condition) |
| Check-in | Door forced to `OCCUPIED` — cleanliness lost | Occupied + Dirty/Clean/Inspected/Pickup can coexist |
| Task | PENDING / IN_PROGRESS / DONE, no type, no business date | Typed job + visit outcome + business date |
| Housekeeper | Code + name | Department, pin-shift, ƏG balance, daily floor pair |
| Mobile | All hotel tasks | Assigned floors today + outcome codes |
| OOO / OOS | Enum exists; UI sets OOO; reports subtract both from sellable | Distinct inventory math |
| Forecast | Occupancy forecast only | HK load by floor 7–14 days |
| Laundry | Revenue code `LAUNDRY` + `postCharge` | Guest ticket → one folio line |

---

## 2. Room state (three axes)

Do **not** add Pickup, SO, or DND as extra `RoomStatus` values.

| Axis | Values | Who changes it |
|------|--------|----------------|
| Inventory | In service / **OOS** / **OOO** | HK + engineering; date range (`RoomClosure`) |
| FO occupancy | Vacant / Occupied | Reservation `IN_HOUSE` (prefer derived) |
| HK condition | Dirty / **Pickup** / Clean / Inspected | Maid / supervisor |

`MAINTENANCE` collapses to OOS or OOO plus a reason from a managed list.

### 2.1 OOO vs OOS

| | OOO | OOS |
|---|-----|-----|
| Meaning | Capital / long repair — left inventory | Temporary (lock, bulb) — still inventory |
| Sell | No | No |
| Occupancy / RevPAR denominator | **Exclude** | **Keep** |

Today `occupancy-p1` / `analysis-p1` treat both as the same subtract. That must change when this axis ships.

### 2.2 Derived job type on the daily sheet

| Signal | Job type on the sheet |
|--------|------------------------|
| Checkout date = business date | Departure |
| In-house, not NSR | Stayover |
| Vacant Dirty | Arrival prep |
| Vacant Clean | Omit or inspect-only |
| Guest refused today | NSR (İstəmədi) |

---

## 3. Opera Cloud — in / out

| Topic | Decision |
|-------|----------|
| Housekeeping / traveling credits | **OUT** this edition. Optional later, default off. Fairness = paired floors + manager DnD |
| Stayover / linen schedule + NSR | **IN** |
| Pickup | **IN** (HK condition) |
| OOO ≠ OOS | **IN** |
| Skip / Sleep (FO vs physical) | **IN** — separate from SO |
| Rush / Queue + push | **OUT**. Soft sort: departures, VIP, needed-by time |
| HK forecast (load) | **IN** (7–14 days). Finance stock norms later |
| Turndown | **OUT** |
| Guest laundry → folio | **IN** |

---

## 4. Departments and shifts

Three stable departments (people do not auto-rotate across them):

| Department | Role | Typical shifts |
|------------|------|----------------|
| **Mərtəbə** | Rooms | Almost all **E** |
| **Meydan** | Public areas | Mix of E / **L**; one person may be **pinned to N** |
| **Çamaşırxana** | Laundry plant | Mostly **L** + rare custom interval |

Named templates (hotel settings, hours editable):

| Code | Hours |
|------|--------|
| E | 08:00–16:00 |
| L | 16:00–00:00 |
| N | 00:00–08:00 |

Per-cell **time override** is allowed (example: 12:00–20:00). Pinned night role is excluded from E/L/N circular shift. The department head sits **on** the Mərtəbə roster (same E/OFF cells, often higher ƏG).

---

## 5. Weekly roster

Settings: period **week** (default) or month; week starts **Monday**; three shift clocks.

Day cell: `E` | `L` | `N` | `OFF` | `ƏG` | custom time.

Auto-propose is a **draft**. Manager may edit every cell. Warnings do not block save (two OFFs on one Mərtəbə day, ƏG at zero balance, pin removed).

### 5.1 OFF

Red **OFF** = planned 6/1 rest. Does **not** change ƏG.

Mərtəbə with 7 people: one OFF per person per week **and** `exactly_one_off_per_day` so coverage is even. Meydan (4) and laundry (3) use 6/1 per person without that cover constraint.

### 5.2 ƏG (compensatory rest)

Green **ƏG** on a day = take one day from the balance. The weekly **ƏG column** is remaining days, not hours and not room credits.

**Accrual:** labour calendar day is off (`holiday` or `transferred_rest`) **and** hotel required HK coverage **and** the person was on duty (not OFF, not ƏG) → +1. Use data-hub / platform production calendar ([production-calendar-ecosystem.md](../../docs/adr/production-calendar-ecosystem.md)). Do not ship a hotel-local holiday table.

Weekend days inside the 6/1 pattern do **not** accrue ƏG. `transferred_working` does not accrue.

**Year-end:** balance **must** be 0 by 31 December. Hotel **does not** pay cash for leftover days. Unused balance **burns on 1 January**. History stays in a ledger. Date to start “pressure on the roster” is a setting (choose later; e.g. 1 November).

---

## 6. Daily floor-pair rotation

Rotation is **daily**, not weekly. Assignment grid: **date × shift (növbə) × person → floor pair**.

Default Nafta pair catalog (settings; disjoint pairs):

```
2–3 · 4–5 · 6–7 · 8–9 · 10–11
```

Floor **1** is not auto-assigned until added to the catalog. Each physical floor appears in **at most one** issued pair per day.

Algorithm (rooms department, morning job or night audit):

1. Who is on duty this date/shift (cell is not OFF / ƏG).
2. Load pair catalog.
3. Rotate yesterday’s ring by **+1 pair** among on-duty staff.
4. Target ≈ one pair (~2 floors) per maid. If fewer people than pairs, leave leftover pairs unassigned and warn (manager assigns by hand).
5. Manager may DnD: reorder print rows, swap pairs, move a row to another department.
6. Next auto run starts from the **saved** assignment, not from a theoretical ring.

Do not paint a single pair on the weekly roster row for the whole week — pairs change every day. Show “today: person → pair” next to the week grid.

---

## 7. Daily floor sheet (Kat Hizmetleri)

**One floor = one printed page.** A maid with one pair gets two pages in **one PDF**. Supervisor pack = all floors for the business date. Report language = **UI locale** (`az` / `ru` / `en`), not Elektra Turkish headers.

### 7.1 Elektra columns (keep)

From `Kat Hizmetleri Raporları` (2026-08-22, floor 4):

| # | Source header | ERA field | Notes |
|---|----------------|-----------|--------|
| 1 | Oda No | Room number | |
| 2 | Oda Durum | HK condition | Dirty / Clean / Pickup / Inspected |
| 3 | Müsaitlik | FO occupancy / availability | Empty in Nafta export; still model |
| 4 | Oda Tipi | Room type | DLX, STWN, SDBL, JSUIT, … |
| 5 | Maid | Assigned maid | Empty in export; fill from rotation |
| 6 | Maid Chef | Supervisor | Empty in export |
| 7 | Kat | Floor | One value per page |
| 8 | Konumu | Location / building / wing | Empty in export; need corpus master data |
| 9 | Misafir İsimleri | Guest names | `/` separated |
| 10 | VIP | VIP | Visual strip from `Guest.vipType` / stay |
| 11 | Acenta | Agency | |
| 12 | Geliş | Stay arrival date | |
| 13 | Geliş Saati | Stay arrival time | `stayArrivalAt` |
| 14 | Ayrılış | Stay departure date | |
| 15 | Geç Çıkış | Late checkout | Empty in export |
| 16 | Kisi | Extra pax slot | Unused / 0 on vacant |
| 17 | Yetişkin | Adults | |
| 18 | Çck | Children | |
| 19 | Repeat | Repeat guest | |
| 20 | Gelen Kişi | **Today** arrivals (pax) | |
| 21 | Geliş Saati (2nd) | **Today** arrival time | `todayArrivalAt` — do not reuse header #13 |
| 22 | Ayrılan Kişi | **Today** departures (pax) | |
| 23 | Ayrılış Saati | **Today** departure time | |
| 24 | Q Saati | TBD | Empty in export — keep slot, do not invent UI until HK manager names it |

Header also: hotel, print timestamp, floor, maid, shift, “in list : N”.

### 7.2 Columns Elektra lacks (add)

| Field | Why |
|-------|-----|
| Nationality (millət) | Manager list; not in the Excel |
| Derived job type | Departure / stayover / arrival-prep |
| Visit outcome | Closed codes below |
| Visit time | Mobile or paper return |

Sort: today’s departures first, then VIP, then other Dirty.

Worked example (floor 4, 22.08.2026): 405 Dirty, 2 pax departed 07:22 → departure; 409 Clean, 1 pax arrived 10:41 → arrival prep done; 411 Dirty Repeat, checkout 23.08 → stayover.

### 7.3 Visit outcome codes (paper)

Closed list (`CatalogFieldKind` `CLOSED_SMALL`). Paper remains valid: print → write → return. Supervisor keys the same codes, or the maid taps them on `/hk/mobile`.

| Paper | Meaning | System | Escalation |
|-------|---------|--------|------------|
| **V** | Tidied, no linen change | HK → Clean | — |
| **VC** | Tidied + sheet/linen change | Clean + linen event | — |
| **OK** | Deep clean (*dərin*) | Clean + type `DEEP` | — |
| **İstəmədi** | Guest refused | Close as NSR; do not mark Clean | — |
| **DND** | Do-not-disturb — did not enter | Open until end of shift | **2nd consecutive day → FO task** |
| **SO** | Sleep-out: belongings in room, guest absent | Occupied + sleep-out | **3rd consecutive day → FO task** |

UI and print show **OK**, not the word *dərin* (legend may explain).

Do not confuse:

| Term | Meaning |
|------|---------|
| SO | Guest away, things in the room |
| Opera Sleep | FO vacant, physically occupied (discrepancy) |
| Opera Skip | FO occupied, physically empty (discrepancy) |
| Pickup | Light HK condition, not a sheet outcome |
| DND | Visit exception, not cleanliness |

Skip / Sleep stay on a discrepancy board; they are not maid sheet codes.

---

## 8. Forecast and priority

**Daily forecast (IN):** 7–14 days from the reservation book: departures, arrivals, stayovers, NSR, VIP, heads on duty — **by floor**. Manager reads it **before** overriding rotation.

**Soft priority (IN):** sort the sheet; optional “needed by HH:MM”. FO sees arrival vs not Inspected. No push notification in this edition.

**Finance inventory (later):** norms × (VC / DEEP / Departure) after those types are stable. Not wave 1.

---

## 9. Guest laundry ticket

Separate from the Çamaşırxana **shift** roster. Same department, different document.

Ticket header: guest (default from in-house stay), room, date, Regular | Express.

Each catalog item row has **two independent steppers**:

`line = washQty × washPrice + ironQty × ironPrice`

Zero qty = service not ordered. Express **+50%** on ticket total (window 09:00–17:00, 3-hour SLA). Regular: in by 10:00 → back 17:00 same day. No intake on Sundays or labour holidays (same production calendar). Pressing hours 09:00–20:00 (ticket rules).

Bill **hotel count** when guest vs hotel qty differ (flag, do not block). One `postCharge` (`LAUNDRY`, 18% tax tag already seeded). Lines stay on the ticket for print and dispute. No second post; void/correct the folio to reverse.

Print reprints the three-language legal ticket (shrinkage, stains, compensation cap 3× wash price). Prices live in an HK catalog, not hardcoded AZN.

Laundry plant uses ticket volume only as a **load hint**, not room credits.

---

## 10. Target screens

| Route | Purpose |
|-------|---------|
| `/hk/roster` | Week grid E/L/N/OFF/ƏG, balance, departments |
| `/hk/rotation` | Date × shift × pairs, auto + DnD |
| `/hk` | Floor sheets, VIP strip, derived job type |
| `/hk/mobile` | My floors today + outcome codes |
| `/hk/forecast` | 7–14 day load |
| `/hk/laundry` | Ticket steppers → folio |
| `/hk/minibar`, `/hk/lost-and-found`, `/hk/closed-rooms` | Keep; closed-rooms gain real OOO≠OOS |

`/hk/maids` code+name CRUD is not the roster.

### 10.1 Manager DnD

| Gesture | Effect |
|---------|--------|
| Reorder rows inside a department | Print order |
| Drop row on row | Swap floor pairs |
| Drop row on another department | Move for that week/day |

Change a shift cell with a closed select, not drag.

---

## 11. Delivery waves

| Wave | Scope |
|------|--------|
| **0** | Three axes + building/floor (`Konumu`) + task type + business date |
| **1** | Three departments, roster, ƏG, daily pair rotation, Elektra sheet + outcomes, Pickup, OOO≠OOS stats |
| **2** | Stayover/NSR on the reservation, DND×2 / SO×3, Skip/Sleep, soft priority, nationality on the sheet |
| **3** | HK forecast 7–14 days |
| **Later** | Credits (default off); linen norms → finance inventory |
| **OUT** | Turndown; rush-push; ƏG cash payout |

No Scaffold ✅ / SHIPPED / Pilot-ready on this deepen without UAT-SMOKE UI evidence and matrix updates (`task-acceptance.mdc`).

---

## 12. Still open (does not block the spec)

- **Q Saati** meaning (empty in the 22.08 export).
- When to start ƏG roster pressure (setting; 1 Nov is a candidate).
- Exact Nafta building/wing list for `Konumu` (rooms today have `floor` + `location` only).

---

## 13. Settings checklist

| Setting | Default |
|---------|---------|
| Roster period | Week (Mon–Sun) |
| Shift clocks | E / L / N as above |
| Mərtəbə OFF cover | Exactly one OFF per day when headcount = 7 |
| Floor pair catalog | `2–3`, `4–5`, `6–7`, `8–9`, `10–11` |
| Floors per maid | 1 pair |
| ƏG burn | 1 January |
| ƏG pressure-from | TBD |
| Inspected required to assign | Already in clone-spec (keep) |
| Linen / deep every N nights | Hotel policy + stay override (wave 2) |
