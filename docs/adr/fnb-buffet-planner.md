# ADR: F&B Buffet Planner module

**Status:** Accepted  
**Date:** 2026-10-27  
**Satellite:** `era-fnb-pos` (`industry_fnb_pos`)  
**Module key:** `fnb_buffet_planner` · **39 AZN / mo** · `catalog_kind=MODULE`

## Context

Sanatorium and canteen operations need a production plan per meal (covers → stations → portions → materials). `/admin/daily-menu` only toggles which dishes appear on the POS/QR board. Stock SoT stays in Finance. Hotel occupancy can feed covers but many sites run a buffet without PMS.

## Decision

1. **Commercial taxonomy:** Buffet Planner is a **module** of the F&B **satellite** (same pattern as `fnb_kitchen_kds`), not a satellite and not a platform add-on. Gate remains `industry_fnb_pos`.
2. **Price:** 39 AZN/month in `pricing_modules`.
3. **Covers:** manual-first (chef/manager enters or uses templates). Optional hotel covers pull when the org has hotel bridge/`hotelMode` — never a hard entitlement precondition.
4. **Outlet = café:** each F&B `Outlet` has its own menu categories/items and its own buffet plans (Nafta: several cafés in one org).
5. **Daily menu:** optional “publish plan lines to daily board” for that outlet/date — **merge** (upsert) dishes onto the board; never wipe other meals’ rows for the same date. Daily-menu is not the SKU packaging.
6. **Materials:** explode Finance BOM via `MenuItem.recipeSku` / `financeSku`; balances and purchase drafts live in Finance. F&B does not store stock quantities.
7. **Related debt:** `FIN-INV-SCOPE-01` — warehouse data-scope so a chef sees only kitchen/café warehouses.

## Consequences

- Nav `/admin/buffet` and APIs require `fnb_buffet_planner` in `activeModules` when modules are metered (same rule as KDS).
- UI: list tables + ModalShell CRUD; outlet and menu item pickers from DB (`CatalogField`).
- Product-Readiness / edition `ga` stay closed until Pilot UAT; COVERAGE starts API/SCREEN.

## Out of scope (v1)

- Stock ledger inside F&B  
- Hard-require hotel  
- Auto-PO without approval  
- Merging SKU into daily-menu  
