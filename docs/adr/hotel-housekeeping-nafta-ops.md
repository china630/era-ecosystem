# ADR: Hotel housekeeping — Nafta ops (roster, floor sheet, laundry)

**Status:** Accepted  
**Date:** 2026-08-22  
**Scope:** `era-hotel-pms` — HK deepen for Nafta Sanatorium (other hotels reuse settings)  
**Spec SSOT:** [`era-hotel-pms/doc/HK-NAFTA-OPS.md`](../../era-hotel-pms/doc/HK-NAFTA-OPS.md)

Related: [production-calendar-ecosystem.md](./production-calendar-ecosystem.md) · [hotel-auto-pricing-production-calendar.md](./hotel-auto-pricing-production-calendar.md) · clone-spec [10-housekeeping.md](../../era-hotel-pms/doc/clone-spec/10-housekeeping.md)

## Context

Scaffold HK (`AC-HOT-HK`) ships a single `RoomStatus` mix (occupancy + cleanliness + inventory), `HousekeepingTask` without task type or business date, and a code+name `Housekeeper` list. Nafta HK already runs on paper:

- weekly duty roster (Mərtəbə / Meydan / Çamaşırxana, shifts E/L/N, OFF, compensatory **ƏG**);
- daily paired-floor rotation;
- Elektraweb *Kat Hizmetleri* floor sheet (one floor per page);
- handwritten visit outcomes (V, VC, OK, İstəmədi, DND, SO);
- guest laundry ticket posted to the folio.

Opera Cloud practices (credits, turndown, rush-push) do not match this labour model. Check-in today overwrites the door to `OCCUPIED` and drops cleanliness — stayover Dirty, Pickup, Skip/Sleep cannot be represented honestly.

## Decision

1. **Three room axes** (do not add Pickup / SO as extra `RoomStatus` values):
   - Inventory: in service / **OOS** / **OOO** (date-bounded; `MAINTENANCE` collapses to OOS/OOO + reason).
   - FO occupancy: vacant / occupied — derived from `IN_HOUSE`, not the sole stored truth.
   - HK condition: Dirty / Pickup / Clean / Inspected.
2. **OOO vs OOS in statistics:** OOO leaves inventory (excluded from occupancy / RevPAR denominator). OOS stays in inventory and only blocks sell. Today both are subtracted the same way — that is wrong after this wave.
3. **Three HK departments** are first-class (rooms / public area / laundry), not filters on one maid list. Shift templates **E 08:00–16:00**, **L 16:00–00:00**, **N 00:00–08:00**, plus per-cell time override. Night public-area role may be **pinned**.
4. **Roster is a draft the manager owns.** Auto-propose week (6/1 OFF; Mərtəbə: exactly one OFF per calendar day when headcount is 7). Any cell is editable. Drag-and-drop: reorder rows, swap floor pairs, move person between departments. Shift codes use `CatalogField` / closed list — not free text.
5. **ƏG** is a compensatory rest **balance** (work on a labour-calendar holiday while the hotel required coverage), not a room credit. Accrual uses the shared AZ production calendar (not a hotel-local `az-2026.ts`). Weekly OFF does not accrue ƏG. Balance **must reach 0 by 31 Dec**; unused days **burn 1 Jan**; hotel does **not** pay cash in lieu. Pressure-to-schedule start date is a setting (undecided; default later).
6. **Floor assignment unit is a pair**, catalog default for Nafta: `2–3`, `4–5`, `6–7`, `8–9`, `10–11`. Rotation is **daily** (+1 pair on the ring among staff who are on duty that shift). Floor 1 is not in the default catalog. Manager override always wins; next auto run continues from the **saved** assignment.
7. **Daily floor sheet** matches Elektra *Kat Hizmetleri* columns plus nationality, derived job type (departure / stayover / arrival-prep), and a visit-outcome code. Print: one PDF, **one floor per page**, locale = UI language (`az` / `ru` / `en`).
8. **Visit outcomes** are a closed catalog (paper codes). **OK** on the sheet means deep clean (not the word *dərin*). **SO** (sleep-out: belongings present, guest absent) is not Opera **Sleep**. DND two consecutive days → FO task. SO three consecutive days → FO task.
9. **Guest laundry** is a ticket (wash qty and iron qty as independent steppers on one item row) → one `FolioCharge` with revenue code `LAUNDRY`. Staff laundry roster is a separate stream.
10. **Opera credits, traveling credits, turndown, and rush-push are out** of this edition. Soft priority (departures, VIP, needed-by) and a 7–14 day HK load forecast are in. Finance inventory norms from linen counts are later.

## Explicitly not in this edition

- Housekeeping credits / traveling credits (optional later, default off).
- Turndown service.
- Push / Opera Queue Rooms.
- Cash payout for leftover ƏG.
- Consumable reservation into `era-finance-core` `/inventory/*`.
- Changing Product-Readiness HK ✅ solely because this spec exists — scaffold Dirty/Clean/Inspected stays; this deepen is **declared, not SHIPPED**.

## Consequences

- Wave 0 must split room state before Pickup, Skip/Sleep, and stayover Dirty can ship.
- Night audit or a morning job generates the next business-date sheet from the reservation book + roster + pair rotation.
- `/hk/maids` CRUD is not the roster; new screens are specified in the SSOT.
- Occupancy / RevPAR reports must treat OOO and OOS differently when inventory axis ships.
- Engineering SCREEN landed 2026-08-22 (folio laundry round-trip, sheet print, DnD roster, discrepancy board, OOO≠OOS reports). UAT-SMOKE §34 remains open — not SHIPPED.
