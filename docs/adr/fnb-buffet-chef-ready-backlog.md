# F&B buffet — chef-ready product backlog (SSOT)

**Status:** Partial — WO1–10 + polish B3/B5/B6 + C1/C2/C7/C9–C12 landed; A9 punchlist **blocked**; C8 roles = future RBAC (not this UI wave). Still **API/SCREEN** — not Demo/SHOW.  
**Date:** 2026-10-29  
**Capability:** `FNB-BUFFET-COST-01`  
**Related:** [fnb-buffet-cost-attribution.md](./fnb-buffet-cost-attribution.md) · [fnb-buffet-cost-attribution-waves.md](./fnb-buffet-cost-attribution-waves.md) · [fnb-buffet-planner.md](./fnb-buffet-planner.md) · managed lists [managed-lists-vs-enums.md](./managed-lists-vs-enums.md)  
**Lab evidence (unsigned):** [`reports/fnb-buffet-cost-lab-signoff.md`](../../reports/fnb-buffet-cost-lab-signoff.md) · punchlist [`reports/fnb-buffet-chef-ready-punchlist.md`](../../reports/fnb-buffet-chef-ready-punchlist.md)

## Goal

Довести buffet cost до продукта, который **можно вести шефу по экранам**: полный **API + BE + UI/UX** по kit canon (`CatalogField` / managed lists), без «хвостов» free-text на pick-list полях.

Это **не** то же самое, что Acceptance **Demo ✅ / SHOW / Pilot / sell**:

| Layer | Meaning |
|-------|---------|
| This backlog | Product quality for a live chef walkthrough |
| Demo ✅ / SHOW | After **human** live pass + signed lab/pilot evidence ([Fnb-Evidence-Rules.md](../acceptance/Fnb-Evidence-Rules.md)) |
| Unsigned seed signoff | Lab template only — does **not** excuse unfinished UI |

Do **not** claim chef-ready / Demo ✅ / SHOW / SHIPPED / `ga` from this backlog file alone.

---

## Already landed (engineering contour)

| Slice | What | Paths |
|-------|------|--------|
| Waves 1–6 | Settings HYBRID, week template + mgmt, staff covers+overlap, COMP attribution API, Finance FOOD cost run, forecast pack + Non-FOOD budget | F&B `/admin/settings`, `/admin/buffet`; Finance `/inventory/buffet-food-cost` |
| Phase A | `hybrid-handoff` + Open Finance HYBRID (no primary JSON paste) | `GET /api/admin/buffet/hybrid-handoff` |
| Phase B | Forecast form, Staff honesty, covers rollup card, Cost run console | Buffet* panels |
| Phase C | Finance kit form, buckets, ISSUES_ONLY, Non-FOOD Field, WH `costClass` CatalogField | Finance web |
| Phase D + second-pass | Lab seeds F&B+Finance (FOOD + Non-FOOD fact, ISSUES_ONLY soft-delete, override merge) | `npm run db:seed:buffet-demo` |

**COVERAGE / PRM today:** API + **SCREEN** — not SHIPPED / not SHOW / Demo unsigned / `S-BUFFET-COST` `[ ]` / `fnb.yaml` `mvp`.

---

## A — Must (показ врёт или ломается)

Mark `[x]` only when fixed in code + smokeable on lab.

- [x] **A1 — COMP AZN ≈ 0 on chef path**  
  Handoff resolves Finance catalog `unitPrice` → `unitCogsBySku` (`buffet-finance-unit-cogs` + hybrid-handoff). Chef warning if catalog unavailable / missing SKU.

- [x] **A2 — Staff gross typed by hand**  
  `staffMealAznPerCover` org default (4) × staff plan covers; Cost run override Field only when set.

- [x] **A3 — Forecast SKU / unit free text**  
  Forecast SKU `CatalogField` SEARCHABLE (Finance products + norms); unit CLOSED_SMALL `kg|L|pcs|g|ml`.

- [x] **A4 — Finance WH `satelliteOutletCode` raw `<input>`**  
  Inventory settings WH outlet → `CatalogField` SEARCHABLE (lab defaults NAFTANI/RESTAURANT/KAFE + tagged WH codes).

- [x] **A5 — Stale settings copy «later waves»**  
  `buffetCostHint` en/az/ru describe live HYBRID + Cost run + Open Finance.

- [x] **A6 — First-run / module gate**  
  Buffet page banner when `fnb_buffet_planner` missing from `/api/auth/me` activeModules; Forecast/Cost empty CTAs.

- [x] **A7 — Outlet F&B ↔ Finance code match guard**  
  Finance cost-run `OUTLET_CODE_MISMATCH` warning + page banner; Cost run shows outlet code.

- [x] **A8 — Theoretical = 0 silent**  
  Cost run amber CTA → Forecast when NO_GUEST_NIGHTS / NORMS_ALL_ZERO / theo ≤ 0.

- [x] **A9 — Live browser chef-path punchlist**  
  Unsigned punchlist written; **live browser blocked** (F&B/Finance health timeout). See [`reports/fnb-buffet-chef-ready-punchlist.md`](../../reports/fnb-buffet-chef-ready-punchlist.md).

---

## B — Kit canon / UX polish

- [x] **B1 — Forecast bands** — band `code` via `CatalogField` CLOSED_SMALL `LOW|MID|HIGH` (+ existing codes).
- [x] **B2 — Finance buffet page outlet filter** — `CatalogField` SEARCHABLE; Advanced JSON stays debug-only.
- [x] **B3 — Sibling Buffet* Field audit** — Week/Staff/Cost settings/Admin/Forecast: enums = `CatalogField`; names/notes/amounts/dates stay Field FREE_TEXT.
- [x] **B4 — i18n trio** — en/az/ru for chef-path strings touched in this wave (hint, staff auto, module/theo CTAs, chef warnings).
- [x] **B5 — CTA hierarchy** — Cost run: Refresh + staff override demoted (secondary / collapsed); sole primary = **Open Finance HYBRID**. Finance Advanced JSON stays debug.
- [x] **B6 — A11y** — Forecast qty/AZN Fields + WH/outlet CatalogField have visible labels (not empty `label=""`).

---

## C — Product depth (chef mental model)

- [x] **C1 — Staff dish lines** — covers-only + on-screen `staffCompositionLater` honesty (composition later).
- [x] **C2 — Hotel guest-nights** — `forecastManualHonesty`: manual / override for Nafta demo; live PMS later.
- [x] **C4 — Print / PDF / week report export** — Finance buffet-food-cost **Print report** + `@media print` (hide forms/nav; keep buckets/SKU/Non-FOOD).
- [x] **C5 — SKU variance narrative** — SKU table highlight + title when out-of-band vs theoretical.
- [x] **C6 — Stocktake workflow CTA** — ISSUES_ONLY → settings `#warehouses` + `/inventory/audits`.
- [x] **C7 — INVENTORY_GT** — hide plan field when no GT WH (and plan 0); CTA to tag WH.
- [ ] **C8 — Roles** — chef vs SatAdmin grants for Forecast / Cost run without excess admin (later).
- [x] **C9 — Hoodmani / XUDMANI OFF visible** — buffet header shows effective outlet model (OFF amber).
- [x] **C10 — KAFE vs NAFTANI** — default outlet prefers `NAFTANI` over KAFE/café.
- [x] **C11 — COMP missing `recipeSku`** — handoff chefWarning `MISSING_RECIPE_SKU` (+ i18n).
- [x] **C12 — FIN-INV-SCOPE chef WH filter** — `#warehouses` deep-link auto-selects FOOD filter on Inventory settings.

---

## D — ADR non-goals (v1 — do not block show if not promised)

From [fnb-buffet-cost-attribution.md](./fnb-buffet-cost-attribution.md) § Non-goals / waves Explicitly later:

- Gram-perfect buffet line weighing
- SKU-level circular reuse ledger
- Tax GL identity with management residual
- Seasonal template versioning
- `ISSUE_TO_KITCHEN` posting mode (unless pilot demands)
- Week bulk-copy beyond current plan copy API
- **Finance twin buffet settings (was C3)** — **won't do**. HYBRID/overlap SoT stays F&B Settings; Finance owns FOOD usage / residual report only. No second settings screen (duplicate + drift). No product requirement for finance-only knobs.

---

## Work order (implementation sequence)

1. **A1** COMP unit COGS from Finance → handoff  
2. **A2** Staff cost auto (override only)  
3. **A3 + B1** Forecast CatalogField SKU/UoM + bands  
4. **A4 + B2** Finance outlet / WH CatalogField  
5. **A5 + B4** Copy / i18n «waves done»  
6. **A6 + A7 + A8** Empty states, module sync, outlet match, theo CTA  
7. **C5 + C6** SKU variance readability + stocktake CTA  
8. **C4** Print/export (if takeaway required for show)  
9. **A9** Browser UAT chef path → punchlist  
10. **B3 + B5 + B6 + remaining C** polish (C3 = won't-do / § D; C8 = future RBAC, not this step); then human signoff → Demo/SHOW only with Evidence Rules  

---

## Acceptance boundary

| Claim | Rule |
|-------|------|
| COVERAGE SHIPPED / UI SHOW | Signed UAT Waves 1–6 + Phase A–D chef/Finance + no Critical residual ([Fnb-Evidence-Rules.md](../acceptance/Fnb-Evidence-Rules.md)) |
| Demo ✅ | Human signs [`reports/fnb-buffet-cost-lab-signoff.md`](../../reports/fnb-buffet-cost-lab-signoff.md) after live walkthrough |
| Scaffold ✅ | **Forbidden** without PRD AC + negative path (capability stays out of BE rollup) |
| Pilot / `ga` | `docs/editions/fnb.yaml` + Pilot field proof — not from this backlog alone |
| This ADR | Docs SSOT for gaps; closing checklist items ≠ auto SHOW |

**Closeout when only this file lands:** COVERAGE changelog + SCREEN honesty; IM/PRM/Sprint/`fnb.yaml` unchanged; `npm run check:acceptance`; skip `era-readiness-matrix`.
