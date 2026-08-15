# ADR: Occupancy / load / child pricing feature flags

**Status:** Accepted  
**Date:** 2026-08-10  
**Parent:** [hotel-dynamic-rate-plans.md](./hotel-dynamic-rate-plans.md), [hotel-bar-accounting-vs-package-sell.md](./hotel-bar-accounting-vs-package-sell.md), [hotel-child-pricing-bands.md](./hotel-child-pricing-bands.md)

## Context

Not every property is ready for:

- 2nd/3rd adult + extra-bed supplements on rate plans;
- yield adjustments by hotel occupancy %;
- absolute child AZN (vs % of adult).

Shipping these always-on would break simple BAR rollouts.

## Decision

Store toggles on `HotelProfile.policyJson` (typed in `hotel-policy.service.ts`), default **OFF**:

| Flag | When ON | When OFF |
|------|---------|----------|
| `occupancyPricingEnabled` | Apply `RatePlan` baseOccupancy / extraAdult / thirdAdult / extraBed on recalc | Single room nightly (BAR / `pricePerNight`) |
| `loadBasedPricingEnabled` | Apply active `YieldRule` % by estimated occupancy | Yield rules ignored |
| `childAbsolutePricingEnabled` | Prefer `ChildPricingMatrix.amountOverride` when set | % discount only (+ `freeCount`) |

SatAdmin UI: `/settings/pricing-policy`. Amounts live on Master data rate plans, Child matrix, Yield rules, Package prices.

## Consequences

- Hotels can configure amounts before enabling behaviour.
- Recalc path: `reservation-pricing.service.ts` reads policy each run.
- Coverage: HOT-OCC-01, HOT-PKG-01; HOT-UE-01 Phase A API.
