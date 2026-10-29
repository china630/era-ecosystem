# ADR: F&B buffet cost attribution and outlet COGS modes

**Status:** Accepted (decision 2026-10-28; Waves 1–6 code landed; UAT/Pilot open)  
**Date:** 2026-10-28  
**Products:** `era-fnb-pos`, `era-finance-core`, `era-hotel-pms` (covers feed)  
**Related:** [fnb-buffet-planner.md](./fnb-buffet-planner.md) · [era-kafe-edition.md](./era-kafe-edition.md) §4 · [tenancy-and-outlet-boundaries.md](./tenancy-and-outlet-boundaries.md) · [INTEGRATION_SSO_EVENTS.md](../INTEGRATION_SSO_EVENTS.md) · FIN-INV-SCOPE-01  
**Plan (waves):** [fnb-buffet-cost-attribution-waves.md](./fnb-buffet-cost-attribution-waves.md)  
**Chef-ready gaps (show product):** [fnb-buffet-chef-ready-backlog.md](./fnb-buffet-chef-ready-backlog.md)

**Wave 1 SoT:** org defaults + outlet overrides live in F&B `FnbOrgProfile.buffetCostSettingsJson` (`GET/PATCH /api/settings/buffet-cost`).  
**Wave 6 SoT:** `forecastPack` (bands + key SKU norms) in same JSON; guest-nights in `BuffetGuestNightEntry`; Finance non-FOOD plan in `Organization.settings.outletBudget`.

## Context

Sanatorium / hotel F&B (Nafta and peers) need:

1. **Weekly repeating buffet production plans** (not only one-off daily rows).
2. **Honest buffet food cost** without weighing every plate on the line.
3. **Staff meal plan** that partially overlaps buffet leftovers (configurable %, not portion-precise).
4. **Management meal sign-in** so forecast covers match who actually ate.
5. **Comps / gifts** as zero-price POS lines with real COGS.
6. **Non-food warehouse classes** in budget plan/fact: chemicals, consumables, tableware (“оборудование” / breakage), inventory above a money threshold.
7. **Per-outlet profiles**: e.g. Naftani = buffet; Hoodmani / Disco Bar = à-la-carte only.
8. Alignment with **existing** Finance posting: standalone optional E8 on pay; Nafta department = hotel night-audit **day document** recipe write-off.

There is no single ISO “buffet-only” standard. Practice is USAH-style food cost + inventory usage + variance; local tax/warehouse rules remain Finance SoT.

### E8 on pay (glossary)

Wireflow label **E8** = event `SATELLITE_FB_STOCK_CONSUMPTION_COMPLETED`.  
**On pay** = emitted when a ticket is paid if `STOCK_CONSUMPTION_ENABLED=true` (standalone).  
For a **Nafta department**, Finance **skips** that event; recipe write-off is on the hotel **day document** after night audit.

## Decision

### 1. Two layers (never conflate)

| Layer | Question | SoT |
|-------|----------|-----|
| **Plan / norm** | What to cook; theoretical food; warnings | F&B buffet (+ TTK/BOM norms in Finance) |
| **Fact / cost** | What left the warehouse; attribution | Finance inventory + cost run |

F&B does **not** hold stock balances. Auto “issue BOM × buffet covers” as the **only** buffet fact is **forbidden** in `RESIDUAL` / `HYBRID`.

### 2. Configurable buffet cost model (`buffetCostModel`, per outlet)

| Code | Meaning |
|------|---------|
| `RESIDUAL` | `food_usage − attributed → buffet_cost` |
| `THEORETICAL` | covers × norm (or weekly plan × TTK) for budget/procurement |
| `HYBRID` | **Default sellable:** theoretical + residual actual + **variance** + warnings |
| `POS_ONLY` | Rare; package/fixed buffet via POS only |
| `OFF` | Outlet is à-la-carte only (no buffet cost run) |

### 3. Attribution formula (FOOD only)

```
food_usage       = Finance consumption for FOOD class, outlet-scoped stores, period
pos_attributed   = COGS keyed from sold lines (incl. zero-price → COMP bucket)
staff_net        = staff meal cost after buffet-overlap rule
attributed       = pos_attributed + staff_net
residual_buffet  = food_usage − attributed
theoretical      = f(weekly plan / norms, covers_guest + covers_mgmt [+ overlap share])
variance         = residual_buffet − theoretical
```

One unit of warehouse usage is counted **once**. Overlap must not double-count staff and buffet.

### 4. Staff ↔ buffet overlap (`staffBuffetOverlap`)

| Code | Meaning |
|------|---------|
| `SEPARATE_CENTER` | Staff fully own cost center |
| `OVERLAP_PCT` | Configurable % of staff cost treated as buffet-covered (default **30**, editable; operational coefficient, not calorie math) |
| `LEFTOVER_FIRST` | Buffet residual “feeds” staff need up to pct; remainder = staff center |

Nafta pilot default: `OVERLAP_PCT` or `LEFTOVER_FIRST` with pct=30.

### 5. Cover sources

- Hotel guest-nights: live PMS pull of daily **`pax`** (occupancy series) into `BuffetGuestNightEntry` with `source: HOTEL`; Manual/ESTIMATE remain
- Buffet plan covers (Spawn: Hotel|Manual week adult/child × **`productionFactorPct`** → line portions; guest default 80, staff 100 — not `wastePct`, not `overlapPct`)
- **Management meal log** (person × date × meal × signature) — eaters roster from orch leadership + include/exclude; same guest buffet dishes
- Staff plan covers (manual headcount; templates `kind=STAFF`)

Theoretical and variance use the sum of relevant cover sources. Management log is required for sanatorium forecast accuracy.

### 6. Weekly template

- Repeating Mon–Sun × meal template with **`kind: GUEST | STAFF`** (extensible); daily plans = spawn instances.
- Seasonal versioning = **later** (v1: active flag + kind filter + manual edits).

### 7. Warehouse / budget classes (Finance)

| Class | Role | Typical stocktake |
|-------|------|-------------------|
| `FOOD` | Buffet residual / à-la-carte COGS | Weekly (align cost run) |
| `CHEMICAL` | Budget plan/fact only | Monthly (setting) |
| `CONSUMABLE` | Gloves, napkins — budget only | Monthly |
| `TABLEWARE` | Plates/glasses breakage (“оборудование”) | **Every 15 days** (setting) |
| `INVENTORY_GT` | Items above org threshold (default **500 AZN**) | Quarterly / on movement |

Food residual **excludes** non-FOOD classes. Threshold 500 AZN is an **org setting**, not hardcode.

### 8. COGS posting mode (`cogsPostingMode`, per outlet)

Documents **current** ERA behavior and future options:

| Code | Behavior | Today in ERA |
|------|----------|--------------|
| `SALE_POST` | Recipe/SKU consumption on ticket **pay** (`SATELLITE_FB_STOCK_CONSUMPTION_COMPLETED`, env-gated) | Standalone when `STOCK_CONSUMPTION_ENABLED` |
| `DAY_DOCUMENT` | Sales accumulate; hotel **night audit** day document explodes recipes / writes off goods | **Nafta department** (E8 on pay skipped) |
| `ISSUE_TO_KITCHEN` | Issue to kitchen doc; sales for revenue/theoretical | Not implemented as named mode |
| `PERIOD_END` | Batch from sales at day/shift end | Partially overlaps day document |

Nafta à-la-carte outlets (Hoodmani, Disco Bar): **`DAY_DOCUMENT`**.  
Naftani buffet food cost: **`HYBRID` / `RESIDUAL`** on FOOD usage — **not** per-guest `SALE_POST`.

### 9. TTK / warnings

- TTK/BOM: procurement, theoretical, **soft warnings**.
- Warning thresholds configurable (e.g. actual/theoretical outside ~0.70–1.10 on key SKUs).
- Warnings do **not** force gram write-off on the buffet line.

### 10. Inventory (stocktake)

Stocktake = recount of **warehouse / tableware**, not plates on the buffet line.  
Cost run prefers a closed FOOD stocktake for the period; otherwise allow `issues-only` with an explicit reliability flag.

`stocktakePolicy` is **per class** (food weekly, tableware ~15 days, etc.).

## Consequences

- Extend `fnb_buffet_planner` (or sibling surfaces). **Wave 1 done:** settings JSON + `/api/settings/buffet-cost`. **Wave 2 done:** week template + management meals + covers-rollup. **Wave 3 done:** `BuffetStaffMealPlan*` + overlap netting/export + Staff meals tab. **Wave 4 done:** zero-price / COMP tender → named `pos.compAttributedAzn` on `/api/admin/buffet/cost-run-export` + Cost run tab. **Wave 5 done:** Finance HYBRID FOOD cost run (`/api/inventory/buffet-food-cost-run` + `/inventory/buffet-food-cost`) with reliability + soft warnings; F&B deep-link. **Wave 6 done:** forecast pack (guest-nights × key SKU bands) + Finance non-FOOD outlet budget plan/fact; TABLEWARE 15-day cadence in settings UI. **Phase A handoff:** F&B `GET …/hybrid-handoff` + Cost run **Open Finance HYBRID** (`theoSku` query); Finance autofill/auto-run; Advanced JSON collapsed (SCREEN — UAT open). **Phase B:** Forecast pack form + Staff covers honesty + covers rollup card + Cost run console (SCREEN — UAT open). **Phase C:** Finance kit form + HYBRID narrative + Non-FOOD Field grid + WH CatalogField (SCREEN — UAT open).
- Finance: classed usage, FOOD cost run + non-FOOD budget; day-document path unchanged for department à-la-carte.
- Hotel: guest-nights via F&B manual/`HOTEL` rows; **live pull** = PMS bridge occupancy series `pax` → `BuffetGuestNightEntry`; management covers stay in F&B (roster + grid UI).
- Product-Readiness / SHIPPED: new capability rows when waves land; no false GA until UAT.
- `FIN-INV-SCOPE-01`: **progress** — `Warehouse.costClass` + `satelliteOutletCode` for cost-run scope; chef-only warehouse UI filter still later.
- Chef-show product gaps (COMP COGS, CatalogField Forecast, staff auto, etc.): [fnb-buffet-chef-ready-backlog.md](./fnb-buffet-chef-ready-backlog.md) — SCREEN until closed + Evidence Rules.

## Non-goals (v1)

- Gram-perfect buffet line weighing
- SKU-level circular reuse ledger (eggs → salad)
- Tax GL identity with management residual (management report first; GL posting optional later)
- Seasonal template versioning
- Implementing `ISSUE_TO_KITCHEN` unless a pilot demands it

## Nafta mapping (example, not hardcode)

| Outlet | Profile | buffetCostModel | cogsPostingMode |
|--------|---------|-----------------|-----------------|
| Naftani | Buffet | `HYBRID` | FOOD residual / HYBRID period; any POS lines via day doc |
| Hoodmani | À-la-carte | `OFF` | `DAY_DOCUMENT` |
| Disco Bar | À-la-carte | `OFF` | `DAY_DOCUMENT` |

Hoodmani foyer + terrace = halls of one outlet unless a separate warehouse is declared.
