# ADR: Hotel child pricing bands (appendix)

**Status:** Accepted  
**Date:** 2026-06-13  
**Parent:** [hotel-dynamic-rate-plans.md](./hotel-dynamic-rate-plans.md)

## Rule

Child supplement is applied **on top of the adult room nightly rate** after contract/discount rules:

```
childAddonNightly = Σ (count × adultNightly × (100 − discountPercent) / 100)
totalNightly = adultNightly + childAddonNightly
```

`discountPercent` comes from `ChildPricingMatrix` row matching representative age:

| Reservation field | Representative age | Typical TZ band |
|-------------------|-------------------|-----------------|
| `children1_0` | 1 | 0–6 (often free) |
| `children5_2` | 3 | 0–6 |
| `children11_6` | 8 | 7–11 |

If matrix is empty, defaults apply: 0–6 → 100% discount (free), 7–11 → 50%, 12+ → 0%.

Children aged 12+ should be counted in `adults`, not child fields.

### Extensions (2026-08)

| Field | Role |
|-------|------|
| `freeCount` | First N children in the band free (e.g. 1 under-6) |
| `amountOverride` | Absolute AZN / paying child / night when `policy.childAbsolutePricingEnabled` |

UI: `/distribution/child-matrix` (full CRUD). Master toggle: `/settings/pricing-policy`.

## Integration point

`recalcReservationDailyRates()` in `reservation-pricing.service.ts` calls `computeChildNightlyAddon()` from `pricing-engine-core.ts`.
