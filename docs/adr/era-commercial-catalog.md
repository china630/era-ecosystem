# ADR: ERA commercial catalog freeze (19 / 29 / 39 / 99)

**Status:** Accepted  
**Date:** 2026-09-07  
**Product:** Control-plane billing (`era-orchestrator` `pricing_modules`)

## Context

Industry SKUs, finance add-ons, and platform meters used ad-hoc AZN prices (8, 12, 15, 18, 22, 38, 49). Cores (`nas`, `banking_core`) were 0 AZN. Clinic M0–M14 were free. XOR (Data HUB tiers, loyalty vs retail promo, hotel medical vs clinic sanatorium) was not enforced.

## Decision

1. **SKU palette** is 19 / 29 / 39 / 99 AZN. Foundation stays 29. Banking gate and core are 99 (Sandbox / Pilot list price).
2. **Two contours:** subscription SKUs vs meters (headcount 2/4 AZN, rooms 4 AZN, documents 5 AZN / 1000 — invoices count as documents, no 0.10/invoice meter — OCR 0.02, SMS operator+0.01, WA 0.05, acquiring 1.5%).
3. **Gate vs Core:** short verticals — Gate 29 includes the operator workplace + 1 capacity unit. Hotel and clinic sell operational cores as separate modules.
4. **XOR** in `applyCatalogMutex`: Data HUB Bronze/Silver/Gold; Workforce Base/PRO; `platform_loyalty` vs `retail_promotions`; `platform_delivery` vs `fnb_delivery_hub`; `hotel_medical_sanatorium` vs `clinic_sanatorium_clinical`. Hotel Sanatorium bundle cannot be enabled with the clinic sanatorium SKU (`MUTEX_SANATORIUM_MEDICAL`).
5. **Commercial clinic SKUs** (`clinic_registry_emr`, `clinic_sanatorium_clinical`, `clinic_nurse_roster`) grant legacy M1–M4/M10 keys at 0 AZN for entitlement dual-read.
6. Production CBS (AzeriCard / AZIPS) is **Custom Quote**, not this list. Seed names mark banking as Sandbox / Pilot.

## Consequences

- `syncPricingModuleCatalog` overwrites `pricing_modules` prices/names from seed on API bootstrap.
- Hotel Resort bundle list: 222 AZN × 15% = **188.70 AZN** (see `pricing-catalog-canon.spec.ts`).
- Capacity overage (rooms, cabinets, POS) is catalog policy (`CAPACITY_DRIVERS`); metering those units in QuotaGuard is a follow-up (not this ADR).
- Existing orgs pick up new list prices at next catalog sync; entitlements are not rewritten except mutex on the next module toggle.

## References

Canon: `era-orchestrator/packages/database/prisma/lib/core/pricing-catalog-canon.ts`  
Seed: `pricing-module-seed.ts`  
Related: [orchestrator-satellite-vs-module.md](./orchestrator-satellite-vs-module.md), [PLATFORM_ADDONS.md](../PLATFORM_ADDONS.md)
