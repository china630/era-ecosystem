# Nafta — BAR accounting base (2026)

**Status:** Product-locked 2026-08-10.  
**ADR:** [hotel-bar-accounting-vs-package-sell.md](../../../docs/adr/hotel-bar-accounting-vs-package-sell.md)  
**Costing reference:** [reference/hotel-costing-and-pricing-usali.md](./reference/hotel-costing-and-pricing-usali.md) (+ PDF in same folder)

## Product rules (locked)

1. **BAR** = **accounting base** (folio / night-audit split + recommended floor). Leadership may set BAR from market; system still stores composition for CPOR/floor.
2. **Medical packages** = primary **sell** products. Final package prices are entered **manually** by sales and **are not required** to match BAR.
3. Each package has **cost floor (min)** + **sell**, both with **history + audit** (implementation backlog).
4. **Cash integrity:** Σ folio postings for a stay = reservation sell; BAR used for split + residual, never silent drift.

Commercial package PDF: `NAFTA PRICE & PACKAGES LIST - 2026 (AZE RU ENG).pdf`.

---

## Versioned components (settings — planned)

| Code | Meaning | Sell | COGS | Unit |
|------|---------|-----:|-----:|------|
| `SVC_FEE` | Service fee — linen/service | **6** | ~5 | per person / night |
| `MEAL_BREAKFAST` | Breakfast | **25** | (part of food 16/day) | per person / meal |
| `MEAL_LUNCH` | Lunch | **25** | | per person / meal |
| `MEAL_DINNER` | Dinner | **25** | | per person / meal |
| Food bundle COGS | FB food | — | **16** | per person / day |
| Medical base COGS | Package medicine | — | **20** | per person / night (package) |

Change of sell/COGS = new effective-dated version + audit (do not overwrite in place).

---

## Composition

```
RO (room only — one amount per room / night)
  + SVC_FEE × N adults
  + meals × N adults
  → BAR BB / BAR FB (accounting totals for N adults)
```

| Product | Formula |
|---------|---------|
| **RO** | Shared room component (not multiplied by adults) |
| **BB** | `RO + (6 + 25) × N` |
| **FB** | `RO + (6 + 75) × N` = BB + lunch+dinner × N |
| **Extra adult** | **+31** on BB (6+25) or **+81** on FB (6+75) — never +RO |

Anchor check (Standart low, N=1): BB sell **70** → `RO = 70 − 6 − 25 = **39**`.

Leadership may **override** published BAR BB/FB cells from market; recommended minimum from components should still be visible in UI (future).

---

## RO matrix (derived from BB₁ − 31)

| Room type | Low | High |
|-----------|----:|-----:|
| Standart DBL/Twin | 39 | 49 |
| Junior Suite | 49 | 65 |
| Deluxe | 61 | 71 |
| Triple | 60 | 84 |

## BAR BB (AZN / room / night)

| Room type | Season | 1 adult | 2 adults |
|-----------|--------|--------:|---------:|
| Standart | Low | 70 | 101 |
| Standart | High | 80 | 111 |
| Junior | Low | 80 | 111 |
| Junior | High | 96 | 127 |
| Deluxe | Low | 92 | 123 |
| Deluxe | High | 102 | 133 |
| Triple | Low | 91 | 122 |
| Triple | High | 115 | 146 |

## BAR FB — no medical (AZN / room / night)

| Room type | Season | 1 adult | 2 adults |
|-----------|--------|--------:|---------:|
| Standart | Low | 120 | 201 |
| Standart | High | 130 | 211 |
| Junior | Low | 130 | 211 |
| Junior | High | 146 | 227 |
| Deluxe | Low | 142 | 223 |
| Deluxe | High | 152 | 233 |
| Triple | Low | 141 | 222 |
| Triple | High | 165 | 246 |

Legacy ladder method (BB from Standart package single deltas, Triple from 285/219 · 343/239) remains the source of the 1-adult BB column above; RO/2-adult rows follow the composition rules.

---

## Packages vs BAR (illustrative)

Package sell is **manual** (PDF / sales). Comparison for control only:

| | BAR FB (1) | PDF Standart single | Δ (package − FB) |
|--|----------:|--------------------:|-----------------:|
| Standart low | 120 | 129 | +9 (medical sell residual) |
| Standart high | 130 | 139 | +9 |

Double occupancy PDF rates are **per person** and need not equal `BAR_FB₂ / 2`. Do not force package sell to BAR.

Premium / Dermo / Detoks: flat PDF sell; room class JR/DLX; BAR row for that room used only for split.

---

## Machine file

[BAR_DERIVED_2026_rows.csv](./BAR_DERIVED_2026_rows.csv)

## Open / backlog

- [x] Settings UI: versioned `SVC_FEE` / meals sell+COGS + history — `/settings/pricing-components` (HOT-PC-01)
- [ ] Package `costFloor` + `sellPrice` versions + audit
- [ ] BAR calendar shows **recommended min** from components (USALI/CPOR path)
- [ ] **Management dashboard** (`HOT-UE-01`): BEP, CPOR stack, article COGS/sell trends, below-floor risks — [ADR §5](../../../docs/adr/hotel-bar-accounting-vs-package-sell.md)
- [ ] Finance allocation engine → period CPOR (see reference digest Phase B)
- [ ] Hotel sign-off if market BAR diverges permanently from composed ladder
