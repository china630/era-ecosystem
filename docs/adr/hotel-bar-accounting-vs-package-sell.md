# ADR: BAR as accounting base vs manual package sell

**Status:** Accepted  
**Date:** 2026-08-10  
**Scope:** `era-hotel-pms` pricing + folio/night-audit split; Finance CPOR/allocation (future)

## Context

Nafta sells primarily **medical packages** (PDF price list, per person, single/double). Separately, accounting needs a **BAR ladder** (room + service fee + board) for:

- night / folio revenue split (room vs F&B vs medical residual);
- recommended **floor** so sales do not go below variable cost;
- future yield / auto-BAR.

Hotel leadership sets commercial BAR from **market / competitors**, not pure cost-plus. Building sell prices only from RO+serviceFee+meals caused confusion in Master Data (one flat `BAR-FB` next to `PKG-*`) and risk of **cash/GL drift** when package sell ≠ reconstructed BAR.

Reference material imported into the repo:

- Digest: [hotel-costing-and-pricing-usali.md](../era-hotel-pms/doc/nafta/reference/hotel-costing-and-pricing-usali.md)
- PDF: [hotel-costing-and-pricing-usali.pdf](../era-hotel-pms/doc/nafta/reference/hotel-costing-and-pricing-usali.pdf) (USALI-oriented costing, CPOR, floor, allocation, RM)

## Decision

### 1. Two price truths

| Truth | Purpose | How set |
|-------|---------|---------|
| **BAR accounting base** | Decomposition, CPOR-aware floor, recommended min | BAR calendar / components; may be market-dictated at BB/FB level |
| **Package sell** | What the guest pays (primary commercial product) | **Manual** entry by sales; **not required** to equal BAR |

### 2. BAR composition (Nafta locked inputs)

```
RO (room only, shared per room)
  + service fee × adults          — sell 6 AZN / person / night (versioned setting)
  + meals × adults                — sell 25 AZN / person / meal (versioned)
  → BB / FB accounting totals
```

- Extra adult: **only** service fee + meals (never duplicate RO).
- Meal COGS: **16** AZN / person / day (FB food). Medical package COGS base: **20** AZN.
- Components live in **settings with effective-dated history + audit** (implementation backlog).

### 3. Packages

- Each package stores **`costFloor` (min)** and **`sellPrice`** (and occupancy/season dimensions as needed).
- Both versioned with audit; sales may change sell without changing BAR.
- Soft or hard guard: warn/block when `sellPrice < costFloor` (policy TBD).
- Clinic program quotas still keyed by package code (existing SAN-PKG bridge).

### 3b. Composed nightly sell from per-pax medical SKUs (Wave D / Nafta)

When guests on one reservation have different `medicalPackageCode` values, **one nightly sell** is composed (not two BAR rates):

| Rule | Amount |
|------|--------|
| Main | Highest occupancy-1 sell of that guest’s SKU |
| Companion Standart | +96 AZN (`STANDART_COMPANION` versioned component) |
| Other companion | Half of that SKU’s occupancy-2 (reception qapik → 160 for Dermo/Detoks) |
| Identical SKUs | Occupancy N sell from `RatePlanSellVersion` |

SoT for the stay night = composed amount in `ReservationDailyRate` (and night-audit package split scaled to it). FO folio surfaces `packageCompose` breakdown. See [nafta-compose-sell-and-doctor-bonus.md](./nafta-compose-sell-and-doctor-bonus.md).

### 4. Cash integrity

Reservation **sell** is the posting ceiling for the stay. Night audit / folio lines use BAR (and package floor) for **split**, then residual to medical / discount / override so **Σ postings = sell**. Silent divergence is forbidden.

### 5. Management unit-economics dashboard (required)

Variable costs and unit-economics KPIs are **first-class management UI**, not only Finance reports after month-close.

**Surface:** Hotel Əsas / executive area — extend `/executive` (cockpit already has ADR/RevPAR/revenue) with a dedicated panel or route `/executive/unit-economics` (OrgOwner + hotel manager roles).

**Must show (period selectors: day / MTD / selected month):**

| Block | Metrics / content |
|-------|-------------------|
| **Risk strip** | Rooms sold below recommended floor (count + AZN gap); package sell &lt; costFloor; BAR vs package residual drift alerts |
| **Break-even** | Fixed costs (period), ADR, CPOR, contribution margin, BEP room-nights, BEP occupancy %, actual occupancy vs BEP (gauge) |
| **CPOR stack** | CPOR total + breakdown by driver article: service fee, food COGS, medical COGS, laundry/utilities share (when allocated), other variable |
| **Component trend** | Sell vs COGS over time for each versioned article (`SVC_FEE`, meals, medical…) — sparkline or MoM Δ% |
| **ADR vs floor** | Market/composed BAR BB·FB vs recommended min from components; % of nights at/above floor |
| **What-if (later)** | Slider: ADR −X% or CPOR +Y → new BEP (from costing article) |

Data sources: versioned pricing components + package floor/sell history (Phase A); period CPOR from Finance allocation (Phase B). Until Phase B, dashboard may show **configured COGS** (service fee/meals/medical) × occupied room nights / PAX as a **proxy CPOR** with explicit “estimate” badge.

**Coverage ID:** `HOT-UE-01` (STUB until API+UI ship).

### 6. Future automation (from imported article)

| Phase | Deliverable |
|-------|-------------|
| A | Versioned service-fee/meal components (`/settings/pricing-components`); BAR recommended minimum; packages floor+sell history; **executive unit-economics dashboard** (proxy CPOR + BEP + risk strip) |
| B | Finance allocation engine (historical % / high-low) → period CPOR → dashboard switches from estimate to actual |
| C | Occupancy-tier / pickup rules that move BAR **above** floor (extends [hotel-dynamic-rate-plans.md](./hotel-dynamic-rate-plans.md)) |

Auto-BAR never overwrites package sell; it only updates BAR base and recommendations.

## Consequences

### Positive

- Clear ownership: accounting owns BAR base; sales owns package sell.
- Aligns with USALI CPOR/floor thinking without forcing cost-plus retail.
- Reduces Master Data confusion (packages ≠ derived BAR cells).
- Management sees **cash risk and BEP** before month-end, not only after GL close.

### Negative / follow-up

- Components + `RatePlanSellVersion` shipped (HOT-PC-01 / HOT-PKG-01); occupancy supplements opt-in via policy flags.
- Rate plan master data still keeps legacy `pricePerNight` as base/1-adult sell; package history is versioned separately.
- Market-dictated BAR above computed floor is allowed; below floor requires override reason (policy).
- True CPOR needs Finance allocation (Phase B); Phase A dashboard is estimate-labelled (`/executive/unit-economics`).

## Related

- [BAR_DERIVED_2026.md](../era-hotel-pms/doc/nafta/BAR_DERIVED_2026.md)
- [IMPORT_FILE_CHECKLIST.md](../era-hotel-pms/doc/nafta/IMPORT_FILE_CHECKLIST.md) § A2
- [hotel-dynamic-rate-plans.md](./hotel-dynamic-rate-plans.md)
- [hotel-costing-and-pricing-usali.md](../era-hotel-pms/doc/nafta/reference/hotel-costing-and-pricing-usali.md)
- Executive cockpit: `/executive` (`ExecutiveCockpit`)
