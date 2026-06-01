# ADR: Orchestrator satellite vs module catalog model

## Status

Accepted — 2026-05-31

## Context

The control plane stored satellites (`industry_*`), ERP modules, hotel submodules (`hotel_*`), and platform add-ons (`platform_*`) in one flat `pricing_modules` table and `activeModules` array. UI and code referred to industry **satellites** as **modules**, causing confusion with:

- **Modules** inside a satellite (e.g. `hotel_core`)
- **Tiers** (`TIER_0`–`TIER_3`) — resource limits
- **Add-ons** (`platform_*`) — cross-product services

## Decision

1. Add **`Satellite`** table and **`PricingCatalogKind`** enum (`SATELLITE | MODULE | ADDON`) on `pricing_modules`.
2. **`catalog_kind`** backfilled from key prefix; **`satellite_key`** FK links `hotel_*` rows to `industry_hotel_pms`.
3. Keep **`pricing_modules`** as the billable SKU table (no separate billing rewrite).
4. **`activeModules`** remains the runtime entitlement array; consolidation migration maps legacy hotel keys to 9-key taxonomy.
5. Subscription API continues returning `modules.industryHotelPms` (gate) + `hotelModules` (9 booleans).

## Consequences

- Super-admin and storefront can filter by `catalog_kind`.
- Hospitality catalog registry uses `isSatelliteGate` aligned with DB `SATELLITE` rows.
- Future satellites follow the same pattern: one `industry_*` gate + N submodule keys with `satellite_key` FK.

Migration: `20260531120000_satellite_catalog_and_hotel_module_consolidation`.
