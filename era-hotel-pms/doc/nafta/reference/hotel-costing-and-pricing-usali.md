# Hotel costing & pricing (USALI-oriented digest)

**Source PDF (in repo):** [hotel-costing-and-pricing-usali.pdf](./hotel-costing-and-pricing-usali.pdf)  
**Origin:** research note «Учет расходов и ценообразование в отелях» (imported 2026-08-10).  
**Product ADR:** [hotel-bar-accounting-vs-package-sell.md](../../../../docs/adr/hotel-bar-accounting-vs-package-sell.md)

This digest is the **implementation brief** for future ERA work (hotel PMS + finance). It does not replace Nafta commercial PDF packages.

---

## 1. Cost classification (for ERP / Finance)

| Type | Behaviour | Hotel examples | ERP treatment |
|------|-----------|----------------|---------------|
| **Fixed** | Independent of occupancy | Admin payroll, rent, base HVAC for public areas, software licences | Undistributed operating expenses |
| **Variable** | Only if guest stays | Laundry, amenities, in-room water, OTA commission | Rooms department P&L |
| **Semi-variable** | Base + load-driven | Electricity, water, piece-rate housekeeping | Split via historical % or sub-meters |

Historical split example: 35% electricity always building, 65% driven by occupied room nights.

## 2. Unit economics — CPOR & floor

- **CPOR** (Cost Per Occupied Room) = variable costs attributable to one sold night (laundry, amenities, variable utilities share, variable HK labour, …).
- **Floor price** = at least CPOR. Selling below CPOR = cash loss per stay.
- **Contribution margin** = ADR − CPOR (amount that covers fixed costs).
- **Break-even room nights** ≈ Fixed costs / (ADR − CPOR); then convert to occupancy %.

Nafta near-term components already locked for **sell/COGS parameters** (versioned settings — planned):

| Component | Sell (locked) | COGS (accounting) | Driver |
|-----------|--------------:|------------------:|--------|
| Service fee | **6** AZN / person / night | ~5 | Variable_Guest |
| Meals B / L / D | **25** each / person | FB food **16** / person / day (bundle) | Variable_Guest |
| Medical (base package) | sell residual in package (~9 on Standart low check) | **20** | Package product |

## 3. BAR vs market vs packages

Industry practice in the source note:

- Hotels often set **BAR from market / competitors / demand**, not pure cost-plus.
- Cost model still needed for **floor / recommended minimum** and for **folio / GL split**.
- Dynamic yield: occupancy tiers, booking pace (pickup), LOS rules, displacement analysis — later waves.

**ERA decision (2026-08-10):**

| Layer | Role | Who sets |
|-------|------|----------|
| **BAR (RO → BB → FB)** | Accounting base + recommended floor for night split | Ops/accounting calendar; later auto-suggested from CPOR |
| **Medical packages** | Primary **sell** products | Sales enters final price **manually**; **must not** be forced to equal BAR |
| **Package floor (min)** | Cost / minimum sell | Configured on package; versioned + audit |
| **Package sell** | What guest pays | Sales; versioned + audit; may diverge from BAR |

Cash-risk rule: **folio / night-audit postings must reconcile to reservation sell**, with explicit residual (medical / discount / market override) — never silent BAR≠package drift.

## 4. Future automation (phased)

### Phase A — parameters + floors + management dashboard (near)

1. Versioned **pricing components** (service fee, meals sell+COGS) with history.
2. Manual **BAR calendar** (accounting base) + UI “recommended min” = f(components, occupancy).
3. Packages: `costFloor` + `sellPrice` (1/2 pax, season) with history; sell independent of BAR.
4. **Executive unit-economics dashboard** (`/executive` panel or `/executive/unit-economics`):
   - risk: nights/packages below floor;
   - BEP gauge (fixed costs, ADR, proxy CPOR, actual vs BEP occupancy);
   - CPOR stack by article (service fee, food, medical, …);
   - MoM / sparkline of sell & COGS per article when versions change.
   - Badge **estimate** until Finance allocation supplies actual CPOR.

### Phase B — allocation engine (Finance)

1. `AllocationRule` for semi-variable GL accounts (fixed % + driver `occupied_room_nights` / PAX).
2. Month-close worker → CPOR for period.
3. High-low method to refresh historical fixed %.
4. Dashboard switches proxy → **actual CPOR**; article drill-down to allocated GL.

### Phase C — revenue management

1. Occupancy-tier BAR steps (BAR, +10%, +25%, …) above floor.
2. Pickup / pacing curves vs last year.
3. Optional channel push when tier changes (already have channel adapters).
4. What-if on the same dashboard (ADR/CPOR sliders → new BEP).

## 5. Drivers every cost line should carry

`Driver_Type`: `Fixed` | `Variable_Room` | `Variable_Guest` | `Step_Variable`

Used when building management P&L (USALI-style), separate from fiscal single-invoice posting (dual ledger idea in source).

## 6. Related Nafta docs

- [BAR_DERIVED_2026.md](../BAR_DERIVED_2026.md) — current BAR matrices & components  
- [IMPORT_FILE_CHECKLIST.md](../IMPORT_FILE_CHECKLIST.md) § A2 — commercial package policy  
- [hotel-dynamic-rate-plans.md](../../../../docs/adr/hotel-dynamic-rate-plans.md) — BASE/DERIVED engine  
