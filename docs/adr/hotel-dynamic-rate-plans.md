# ADR: Hotel dynamic rate plans vs contract pricing

**Status:** Accepted  
**Date:** 2026-06-12  
**Scope:** `era-hotel-pms` pricing engine

## Context

Historically, hotel pricing followed an Elektraweb-style **contract anti-pattern**: a monolithic rate plan combined season, room type, meal plan, and agency channel into combinatorial duplicate records. Changing BAR required manual updates across many linked contracts.

Stage 24 introduced `ContractPricingRule` (% discount/supplement by agency + rate plan), which improved quoting but still relied on a flat `RatePlan.pricePerNight` and did not support date-varying BAR or decoupled meal pricing.

## Decision

Replace contract-centric pricing with a **three-layer dynamic model**:

1. **BASE (BAR)** — one base rate plan; absolute prices stored only in `RoomTypeRate` (calendar by room type + date).
2. **DERIVED** — channel/corporate/non-refundable plans with no stored prices; computed on-the-fly via a single-step formula (`PERCENT` or `FIXED`) from the BASE plan.
3. **Add-ons** — meal, SPA, etc. as independent `AddOn` entities linked to rate plans via `RatePlanAddOn` (`INCLUDED` / `OPTIONAL`).

The **PricingEngine** (`pricing-engine-core.ts` + `pricing-engine.service.ts`) assembles quotes with **strict separation** of Room Revenue (`ROOM` / configured `roomRevenueCode`) and Add-on Revenue (`FOOD`, `SPA`, …).

## Consequences

### Positive

- Eliminates combinatorial explosion: one BAR calendar + N derived formulas + M add-ons.
- Per-night derivation supports yield/date-varying BAR without duplicating derived prices.
- Add-on revenue carries its own `RevenueCode`, enabling Orchestrator/Finance to route food revenue to F&B satellite via existing night-audit GL lines (`SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED`).
- Pure calculation core is unit-testable without database.

### Negative / migration

- `ContractPricingRule`, `MealPlan` on `RatePlan`, and flat `RatePlan.pricePerNight` remain during transition.
- Booking/reservation/folio flows still use legacy `quoteBookingRate` until wired to `quoteStay`.
- Admin UI for BAR calendar and add-on catalog not yet built.

## Related (2026-08)

Nafta: BAR = accounting base / floor recommendation; medical **package sell** is manual and need not equal BAR — [hotel-bar-accounting-vs-package-sell.md](./hotel-bar-accounting-vs-package-sell.md).

## Constraints

- Derived plans must reference a BASE plan directly (no derived→derived chains).
- Missing `RoomTypeRate` for a stay night throws `RATE_NOT_LOADED` (no silent zero fallback).
- Money: `Decimal(12,2)` in DB; derivation coefficient `Decimal(12,4)`; round to 2 decimals at output.
- Included add-ons still post as separate folio lines under their `RevenueCode` (not merged into room revenue).

## References

- Migration: `era-hotel-pms/prisma/migrations/20260612120000_dynamic_rate_plans`
- Spec: `era-hotel-pms/doc/clone-spec/09-master-data.md` §9.3
- Revenue routing: `docs/INTEGRATION_SSO_EVENTS.md` (hotel night audit `revenueLines`)
- Supersedes pattern in Stage 24 `ContractPricingRule` (not deleted yet)
