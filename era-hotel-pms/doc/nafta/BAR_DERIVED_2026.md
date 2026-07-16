# Nafta — derived BAR (2026)

**Status:** calculated proposal from accounting inputs + Standart package PDF differentials. Not a published hotel tariff — for PMS `BAR` base plan / folio split until hotel confirms.

**Inputs (accounting, 2026-07-14):**

| Input | AZN | Role |
|-------|----:|------|
| Simplest room, no medical package, **breakfast included** | 70 | Anchor **BAR BB** for Standart |
| Lunch **or** dinner in canteen (sell) | 25 | Each |
| FB food **cost** (COGS) | 16 | Folio/GL cost — not subtracted to get BAR |
| Room cleaning **cost** | 5 | COGS |
| Base package medical (checkups etc.) **cost** | 20 | COGS |

**Board policy (locked):** no RO sale; commercial products are FB packages. HB rare.

---

## Method

1. **Standart, low season, BAR BB** = **70** (accounting).
2. **Other categories / high season** = `70 + (Standart_package_single[room, season] − 129)`.
   Diffs come only from the published Standart **package** single matrix (room-category + season ladder), applied onto the BB anchor.
3. **BAR FB (1 person)** = `BAR_BB + 25 + 25` (add lunch + dinner; breakfast already in BB). Useful for “room + full board, no medical”.
4. **Triple:** no single rate in PDF. Scale Standart BB by package **triple ÷ double** totals for that season:
   - low: `70 × (285 / 219)` → **91**
   - high: `80 × (343 / 239)` → **115**
5. **Premium / Dermo / Detoks:** hotel assigns **Junior or Deluxe** only; package price is medical product. Room BAR = Junior or Deluxe BB from the table (no season split on those packages).

Implied medical sell-through on Standart low single package: `129 − 70 − 50 = 9 AZN` (below medical **cost** 20 — medical is a loss-leader / subsidised in the package).

---

## BAR BB matrix (AZN / room / night)

| Room type | Low (Nov–Apr) | High (May–Oct) |
|-----------|-------------:|---------------:|
| Standart DBL/Twin (22 m²) | 70 | 80 |
| Junior Suite (30 m²) | 80 | 96 |
| Deluxe (42 m²) | 92 | 102 |
| Triple (24 m²) | 91 | 115 |

## BAR FB matrix — 1 adult, no medical (AZN / room / night)

| Room type | Low | High |
|-----------|----:|-----:|
| Standart | 120 | 130 |
| Junior | 130 | 146 |
| Deluxe | 142 | 152 |
| Triple | 141 | 165 |

FB here = BB + lunch + dinner at canteen sell prices. Extra adults: add **50 AZN/person** for L+D (breakfast policy for 2nd adult — confirm with hotel).

## Machine file

Row dump: [BAR_DERIVED_2026_rows.csv](./BAR_DERIVED_2026_rows.csv) (also copied under `Downloads/EW/` when generated).

## Open confirms

- [ ] Hotel accepts this derived BAR ladder (esp. Triple + high season).
- [ ] Double occupancy: same room BAR up to 2 adults, or second adult BB surcharge?
- [ ] Breakfast value inside 70 for 2nd adult / child.
- [ ] Folio night split for package stays: use BAR BB + 50 board sell + residual medical, or COGS-based (16 / 5 / 20) for finance only.
