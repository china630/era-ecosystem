# ADR: ERA commercial catalog freeze (19 / 29 / 39 / 99)

**Status:** Accepted  
**Date:** 2026-09-07  
**Product:** Control-plane billing (`era-orchestrator` `pricing_modules`)

## Context

Industry SKUs, finance add-ons, and platform meters used ad-hoc AZN prices (8, 12, 15, 18, 22, 38, 49). Cores (`nas`, `banking_core`) were 0 AZN. Clinic M0–M14 were free. XOR (Data HUB tiers, loyalty vs retail promo, delivery vs F&B hub) was not enforced. Hotel medical and the clinic sanatorium chart are two products on one property; they are not a mutex.

## Decision

1. **SKU palette** is 19 / 29 / 39 / 99 AZN. Foundation stays 29. Banking gate and core are 99 (Sandbox / Pilot list price).
2. **Two contours:** subscription SKUs vs meters (headcount 2/4 AZN, rooms 4 AZN, documents 5 AZN / 1000 — invoices count as documents, no 0.10/invoice meter — OCR 0.02, SMS operator+0.01, WA 0.05, acquiring 1.5%).
3. **Gate vs Core:** short verticals — Gate 29 includes the operator workplace + 1 capacity unit. Hotel sells operational cores as separate modules. Clinic Gate (`industry_clinic`, 29 AZN) opens the app only — no cabinet quota on the gate.
4. **XOR** in `applyCatalogMutex`: Data HUB Bronze/Silver/Gold; Workforce Base/PRO; `platform_loyalty` vs `retail_promotions`; `platform_delivery` vs `fnb_delivery_hub`. A sanatorium property bills **both** `hotel_medical_sanatorium` (package and folio, inside the Hotel Sanatorium bundle) and `clinic_sanatorium` (clinical chart, 99 AZN). Those keys are not alternatives. `MUTEX_SANATORIUM_MEDICAL` is removed (2026-09-23).
5. **Commercial clinic SKUs** (seven paid modules, 2026-09-24): `clinic_registry_emr` 39, `clinic_lab` 29, `clinic_sanatorium` 99, `clinic_nurse_roster` 19, `clinic_inpatient` 39, `clinic_telehealth` 39, `clinic_insurance` 39. Zero-price clinic keys and `clinic_sanatorium_clinical` are retired. `syncPricingModuleCatalog` rewrites stored `activeModules` (`rewriteClinicActiveModules`) and deletes old `pricing_modules` rows. No dual-read alias: routes use the remaining keys; `/portal` needs `platform_portal`; appointment reminders need `platform_notifications`. Inpatient beds do not open the sanatorium chart.
6. Production CBS (AzeriCard / AZIPS) is **Custom Quote**, not this list. Seed names mark banking as Sandbox / Pilot.

## Consequences

- `syncPricingModuleCatalog` overwrites `pricing_modules` prices/names from seed on API bootstrap and when super-admin loads billing config. `GET /v1/public/pricing` only reads the table. A sync failure is logged (`Pricing catalog sync skipped`) and does not replace the public catalog with an empty snapshot. Clinic key rewrite for existing rows is migration `20260924120000_clinic_commercial_catalog`.
- `syncMeterCatalogCanon` (same boot) writes `billing.meter_unit_pricing_v1` / `billing.quota_unit_pricing_v1`: leftover `pricePerInvoiceAzn` 0.10 → **0**; leftover headcount **10 × 15** → **1 × 2**; document pack below 100 → **1000 / 5 AZN**. Super-admin cannot re-enable a per-invoice meter.
- Hotel Resort bundle list: 232 AZN × 15% = **197.20 AZN** (`hotel_distribution` = 39 AZN, Channel Manager pack — [hotel-channel-manager-pack.md](./hotel-channel-manager-pack.md); see `pricing-catalog-canon.spec.ts`). City = **113.40 AZN**; Sanatorium = **238.48 AZN**.
- Capacity overage for hotel rooms and POS stays on `CAPACITY_DRIVERS` (hotel: 5 rooms + 4 AZN; F&B/retail: 1 station + 19 AZN). Clinic cabinets and beds are **not** on the gate: `CLINIC_MODULE_CAPACITY` includes 5 units on `clinic_registry_emr` / `clinic_sanatorium` (`Room`) and `clinic_inpatient` (`Bed`), then 19 AZN. One room census per org — if `clinic_sanatorium` is on, extra rooms bill there; otherwise on EMR. Beds bill only with inpatient. Meter: `QuotaService.assertClinicCapacityOverage` + `POST /v1/internal/capacity/clinic` (`CLINIC_ROOM_MONTHLY`, `CLINIC_BED_MONTHLY`); clinic cron reports counts once per Baku month (repeat reports do not double). Hotel room numbers are unchanged.
- ERA **station** `pos` / `register` ≠ KKM device count — [era-fiscal-kkm-kit.md](./era-fiscal-kkm-kit.md) §7. The `@era/fiscal` kit is not a billed SKU. **F6 scaffolding:** `QuotaService.assertPosStationOverage` + `POST /v1/internal/capacity/pos-stations` (meter `POS_STATION_MONTHLY`, default 19 AZN); F&B open-shift reports distinct outlets with a till.
- Existing orgs pick up new list prices at next catalog sync (API bootstrap or super-admin billing config). Clinic entitlements are rewritten by migration `20260924120000_clinic_commercial_catalog` (`clinic_sanatorium_clinical` → `clinic_sanatorium`; EMR/lab legacy keys collapse onto the paid SKUs; retired keys dropped) on `active_modules`, `custom_config.modules`, `organization_modules`, and bundle `module_keys`. The same rewrite still runs inside `syncPricingModuleCatalog` for rows missed by the migration. Public module lists fill a missing `satelliteKey` from the key prefix so a Clinic row still groups under `industry_clinic`. Other verticals still apply mutex only on the next module toggle.
- **White-label login (accepted, not in seed yet):** `platform_domain` **19** = one custom hostname → one satellite login; **29** = all entitled satellite logins for that org (mutex). ERA `{orgNo}` subdomains are not this SKU. [org-public-number-and-login-host.md](./org-public-number-and-login-host.md).

## References

Canon: `era-orchestrator/packages/database/prisma/lib/core/pricing-catalog-canon.ts`  
Seed: `pricing-module-seed.ts`  
Related: [orchestrator-satellite-vs-module.md](./orchestrator-satellite-vs-module.md), [PLATFORM_ADDONS.md](../PLATFORM_ADDONS.md), [extensibility-forms-print-reports.md](./extensibility-forms-print-reports.md) (placement planes ≠ this SKU palette; do not seed ONPREM multipliers here)
