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
3. **Covers:** Spawn applies **Hotel pull | Manual** (manual = one adult+child for the week into all slots). Hotel guest-nights sync from PMS `pax` series (`source: HOTEL`). Never a hard entitlement precondition when hotel is down — warn + Manual.
4. **Outlet = café:** each F&B `Outlet` has its own menu categories/items and its own buffet plans (Nafta: several cafés in one org).
5. **Daily menu:** optional “publish plan lines to daily board” for that outlet/date — **merge** (upsert) dishes onto the board; never wipe other meals’ rows for the same date. Daily-menu is not the SKU packaging.
6. **Materials:** explode Finance BOM via `MenuItem.recipeSku` / `financeSku`; balances and purchase drafts live in Finance. F&B does not store stock quantities.
7. **Related debt:** `FIN-INV-SCOPE-01` — warehouse data-scope so a chef sees only kitchen/café warehouses.
8. **Cost attribution (separate ADR):** buffet food cost, staff overlap, management covers, warehouse classes, and COGS posting modes — [fnb-buffet-cost-attribution.md](./fnb-buffet-cost-attribution.md). Planner remains production planning; residual/HYBRID cost runs live in Finance.

## Consequences

- Nav: Buffet **submenu** under `fnb_buffet_planner` — Planlar `/admin/buffet`, Şablonlar `/admin/buffet/templates`, Rəhbərlik `/admin/buffet/management`, Proqnoz `/admin/buffet/forecast`, Normalar `/admin/buffet/norms`, Maya dəyəri `/admin/buffet/cost-run`. Staff is **not** a separate nav item — filter by template/plan `kind` (`GUEST` | `STAFF`). Overlap Personal↔buffet lives in Settings only. On buffet routes, shell hides till/floor café ops even if outlet has `till`.
- **Shared chrome:** `PageHeader.actions` for primary CTAs; `BuffetPageChrome` = filter panel only (outlet/dates/kind/status grid). Nav group: sentence case, collapses when leaving `/admin/buffet/*`. Settings → Buffet integrations stores **Finance web URL** only (Open Finance deep-link). Hotel guest-nights S2S = `resolvePeerSatelliteBaseUrl` (ADR peer-url); HR leadership = orch `resolveOrchestratorBaseUrl` + hub/parent workforce org — not Settings Hotel/Orch URL fields.
- **Week templates:** **list table** + `ModalShell` create/edit; `kind` + `active` + notes; create seeds 21 slots (Mon–Sun × meal); slot editor = menu categories × multi-select dishes; station hidden (`MAIN`); waste from TTK else 0. Soft archive via `active=false`.
- **Spawn (Planlar):** primary CTA week spawn; secondary one plan; template + week Monday + covers Hotel|Manual + `productionFactorPct` (guest default 80, staff 100 from buffet-cost settings; Spawn may override). `plannedPortions = round(covers × factor/100)`. Factor ≠ `wastePct` ≠ `staffBuffetOverlap.overlapPct`. Empty slots warn, do not block.
- Plans UI: master table + ModalShell header/composition/line; compact filters; default outlet **NAFTANI** when present. Copy / `PLAN_SLOT_TAKEN` / copy-lines-from-last unchanged. Never invent outlet code `RESTAURANT` (ops: `scripts/ops/kill-restaurant-outlet.ts`).
- **Management:** date × meal grid; PageHeader CTAs Bufet yeyənlər + Bu gün imzala; today-Baku sign from buffet eaters roster (orch `position.leadership` on hub/parent + self org + include/exclude); if orch down → `ORCH_UNAVAILABLE` + manual add honesty. Past days locked except café admin/chef. Management eats guest buffet — no dish template.
- **Proqnoz / Normalar / Maya:** guest-nights calendar + hotel sync via peer (`HOTEL_UNAVAILABLE` → manual; toast must not ask for Settings Hotel URL); norms SKU/bands + **Saxla** in chrome; Maya = refresh primary → blockers («Əvvəl doldur») before zero cards → Finance secondary; model badge only when ≠ `HYBRID`.
- Second café = Settings outlets create — not from Buffet. Product-Readiness / `ga` closed until Pilot UAT; COVERAGE API/SCREEN until FB-5 **signed**.

## Out of scope (v1)

- Stock ledger inside F&B  
- Hard-require hotel (pull preferred; Manual fallback)  
- Auto-PO without approval  
- Merging SKU into daily-menu  
- Per-dish take rates / staging batches  
- Full job grade catalog (see [cp-workforce-job-architecture.md](./cp-workforce-job-architecture.md))  
