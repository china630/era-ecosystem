# Construction — Product Readiness Matrix (one screen)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.4  
**Purpose:** answer «readiness / can we show / sell?».  
**Not the same as** [`Construction-Implementation-Matrix.md`](./Construction-Implementation-Matrix.md) (= Scaffold BE / AC only).  
**Not** [`READINESS_MATRIX.md`](../READINESS_MATRIX.md) (engineering API/DELIVERY %).

**Sources:** Sprint-Index · Implementation-Matrix · UAT-SMOKE · COVERAGE · Pilot · [`docs/editions/construction.yaml`](../editions/construction.yaml)

**Legend:** ✅ · 🟡 · ❌/`[ ]` · ⏸ external · `n/a`  
**Row rollup** = worst(Gate, BE, UI, Demo/TE, Pilot lab, Pilot field) — not BE alone.

**Closeout (2026-11-10 access denied):** A missing screen grant opens `/access-denied`. Scaffold stays 🟡. Gate / BE / UI / Demo / Pilot / Sell unchanged. Edition yaml untouched.

**Closeout (2026-11-10 entity grid):** `/admin/access` is an entity × View / Change / Operate / Admin grid. Catalog v2 copies a read key once from the write key; GET uses the read key. RBAC row stays API / SCREEN. Scaffold stays 🟡. Gate / BE / UI / Demo / Pilot / Sell unchanged. Edition yaml untouched.

**Closeout (2026-11-17 boundaries + act lines API):** ADR construction-domain-boundaries (Finance/CP/CRM planes fixed). CN-ACT-LINES-01 API; UI NONE; AC-CON-ACT-LINES 🟡 out of BE rollup. Gate ✅ · Scaffold BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]` · edition `mvp` · Sell unchanged. No `ga`.

**Closeout (2026-11-17 Wave 1 scaffold):** CN-W1-SCAFFOLD-01 STUB + empty shells on `/projects/[id]`. AC-CON-W1-SCAFFOLD 🟡 out of BE rollup. Gate ✅ · Scaffold BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]` · edition `mvp` · Sell unchanged. No `ga`.

**Closeout (2026-11-17 Wave 1 second-pass):** soft-delete list filters + honest stub counts on shells. Gate/BE/UI/Demo/Pilot/Sell/edition unchanged.

**Closeout (2026-11-17 Wave 2 MVP):** CN-ACT-LINES-01 SCREEN on `/projects/[id]`; field-ops punch usable; Finance journal idempotent. Gate ✅ · Scaffold BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]` · edition `mvp` · Sell unchanged. No `ga` / SHIPPED.

**Closeout (2026-11-17 Wave 2 second-pass):** draft wipe / zero-amount approve / requisitions CatalogField. Gate/BE/UI/Demo/Pilot/Sell/edition unchanged.

**Closeout (2026-11-18 Wave 3 depth):** CN-W3-DEPTH-01 SCREEN panel on `/projects/[id]`. Gate ✅ · Scaffold BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]` · edition `mvp` · Sell unchanged. No `ga` / SHIPPED.

**Closeout (2026-11-18 Wave 3 second-pass):** field-ops sibling deepen + punch/pin/crew gaps closed. Gate ✅ · Scaffold BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]` · edition `mvp` · Sell unchanged. No `ga` / SHIPPED.

**Closeout (2026-11-18 Wave 4 product):** project hub tabs + structure/schedule/equipment/claims densify. Gate ✅ · Scaffold BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]` · edition `mvp` · Sell: do not claim GA — pilot open. No `ga` / SHIPPED.

**Closeout (2026-11-18 Wave 4 second-pass):** hub mutation FORBIDDEN + submittal Reject/REVISE UX + claim amount guard. Gate ✅ · Scaffold BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]` · edition `mvp` · Sell unchanged. No `ga` / SHIPPED.

**Closeout (2026-11-18 product UI + staff bridge):** CN-BIM SKU gate + URL validate (Ops + `/field-ops` + Depth); CN-STAFF-01 API (`CONSTRUCTION_API_URL` fan-out + staff-provision). UI stays 🟡 SCREEN; Demo/Pilot/Sell/edition untouched. No `ga` / SHIPPED.

**Closeout (2026-11-23 Pilot W2–W4 second-pass):** Contract id stamp on acts; materials hub fallback. Still SCREEN / not SHOW. Gate ✅ · Scaffold BE ✅ · UI 🟡 · Demo 🟡 · Pilot lab `[~]` · Pilot field `[ ]` · `mvp` · `pilot_ready: false`. No `ga`.

**Closeout (2026-11-23 Pilot W2–W4):** Finance bridge + PayApp soft ref + materials soft-ref + lab UAT/Demo TE docs. Still SCREEN / not SHOW / not SHIPPED. Gate ✅ · Scaffold BE ✅ · UI 🟡 · Demo 🟡 (TE unsigned) · Pilot lab `[~]` track via signoff templates · Pilot field `[ ]` · edition `mvp` · `pilot_ready: false` · Sell unchanged. No `ga`.

**Closeout (2026-11-23 Wave 1 second-pass):** HTTP `sovSeedEligible` on approve; act 409 lock copy; Rate bases in ops nav. Still SCREEN / not SHOW / not SHIPPED. Gate ✅ · Scaffold BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]` · edition `mvp` · Sell unchanged. No `ga`.

**Closeout (2026-11-23 Wave 1 pilot contour UX):** Lab path rate→estimate approve→act→Finance feedback deepened on existing SCREEN surfaces + UAT-SMOKE Wave-1 path. Still not SHOW / not SHIPPED. Gate ✅ · Scaffold BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]` · edition `mvp` · Sell unchanged. No `ga`.

**Closeout (2026-11-23 pilot intake anket deepen):** Gray per-field hints + AZ spelling (`tender`, `imzalanmış`, …). Still process artifact only — no API/UI capability, no Demo/Pilot/edition/Sell lift. Gate ✅ · Scaffold BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]` · `mvp`.

**Closeout (2026-11-20 pilot intake anket):** AZ questionnaire Word+MD published (`docs/products/ERA-Construction-Pilot-Anket-AZ.*` · Downloads copy). Sales/pilot process artifact only — no product API/UI capability, no COVERAGE SHIPPED flip. Gate ✅ · Scaffold BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]` · edition `mvp` · Sell unchanged. No `ga`.

**Closeout (2026-11-20 SOV seed second-pass):** orch accepts estimate event; financeContractId fallback on approve/create. Still SCREEN / not SHIPPED. Gate ✅ · Scaffold BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]` · edition `mvp` · Sell unchanged. No `ga`.

**Closeout (2026-11-20 SHARED + estimate SOV seed):** SHARED default in Acceptance; Estimate financeContractId + CSV; Finance SOV seed from approve. AC-CON-EST / AC-CON-TENANT 🟡. Gate ✅ · Scaffold BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]` · edition `mvp` · Sell unchanged. No `ga` / SHIPPED. UAT open.

**Closeout (2026-11-20 estimate hierarchy M20):** CN-EST-01 API+SCREEN (hub Estimate; dual mode; pack/docs/lines; approve→BOQ + event). AC-CON-EST 🟡 out of BE rollup. Gate ✅ · Scaffold BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]` · edition `mvp` · Sell unchanged. No `ga` / SHIPPED.

**Closeout (2026-11-20 estimate second-pass):** UI `apiJson` unwrap + SKU gate copy; access/storefront i18n; runtime seed sync. Still SCREEN / not SHIPPED. Gate/BE/UI/Demo/Pilot/edition/`ga`/Sell unchanged.

**Closeout (2026-11-20 Nest Controllers edge):** API host = Nest Controllers over `@/lib` (UI stays Next). No product surface change. Gate ✅ · Scaffold BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]` · edition `mvp` · Sell unchanged. No `ga` / SHIPPED.

**Closeout (2026-11-20 smeta rate-engine second-pass):** empty rate-base hint on Estimate apply; PRD M21. Still SCREEN / not SHIPPED. AC-CON-SMETA-RATE 🟡. Gate ✅ · Scaffold BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]` · edition `mvp` · Sell unchanged. No `ga`.

**Closeout (2026-11-20 smeta rate-engine MVP):** CN-SMETA-RATE-01 API+SCREEN (`/admin/rate-bases` + Estimate apply); SKU seeded. AC-CON-SMETA-RATE 🟡. Gate ✅ · Scaffold BE ✅ · UI 🟡 · Demo 🟡 · Pilot `[ ]` · edition `mvp` · Sell unchanged. No `ga` / SHIPPED.

---

## Line summary (SSOT readiness)

| Edition | Gate | Scaffold BE | UI | Demo / TE | Pilot lab | Pilot field | Edition | Sell / show |
|---------|------|-------------|----|-----------|-----------|-------------|---------|-------------|
| **Construction** | ✅ | ✅ | 🟡 | 🟡 | [~] | [ ] | `mvp` | do not claim GA — lab templates open; field/`ga` closed |

---

## UI (short)

**UI class rollup:** SCREEN — [UI-COVERAGE-BOARD.md](./UI-COVERAGE-BOARD.md). This table is sell/show; «is there a screen?» lives on the board.

| Surface | Path | Level |
|---------|------|-------|
| Projects | `/projects` | 🟡 — field-ops dates are `DatePicker`. Does not move Gate, UI 🟡, Demo 🟡, Pilot, or edition |
| Plan vs actual | `/projects/[id]` | 🟡 |
| Access matrix | `/admin/access` | 🟡 SCREEN (CN-RBAC-01; not SHOW) |
| Progress act lines | `/projects/[id]` MVP panel | 🟡 SCREEN (CN-ACT-LINES-01; Wave-1 sum/lock/Finance + 409 i18n; not SHOW / not SHIPPED) |
| Field ops daily/punch | `/field-ops` + project MVP | 🟡 SCREEN (W3 second-pass + BIM SKU-gate sibling; not SHOW) |
| Wave 3 depth (parties/RFI/CDE/change) | `/projects/[id]` hub Depth | 🟡 SCREEN (CN-W3-DEPTH-01; not SHOW) |
| Wave 4 product hub | `/projects/[id]` tabs | 🟡 SCREEN (CN-W4-PRODUCT-01; not SHOW) |
| Structure / schedule / equipment / claims | hub tabs | 🟡 SCREEN |
| BIM lite | Ops + `/field-ops` + Depth RFI | 🟡 SCREEN (CN-BIM-01 SKU-gated; not SHOW) |
| Staff provision | CP hire → construction `/login` | 🟡 SCREEN/API (CN-STAFF-01; UAT open; not SHOW) |
| Estimate hierarchy | `/projects/[id]` hub Estimate | 🟡 SCREEN (CN-EST-01; Wave-1 SOV banners + HTTP `sovSeedEligible`; not SHOW / not SHIPPED) |
| Smeta rate engine | `/admin/rate-bases` + ops nav + Estimate apply | 🟡 SCREEN (CN-SMETA-RATE-01; Wave-1 amount>0 / skuOff; not SHOW / not SHIPPED) |

Project create and subcontractor-claim flows now follow the modal CRUD playbook; Demo/TE stays 🟡 until live sign-off.

**Having routes ≠ UI ready for sell.** Demo/TE stays 🟡 until live sign-off. HEADLESS lines use `n/a` with reason.

---

## Pilot / field

| Item | Status | Evidence |
|------|--------|----------|
| Lab RT (UAT-SMOKE) | [~] | `era-construction/doc/UAT-SMOKE.md` Wave-1 + Pilot W2–W4; signoff templates unsigned |
| Demo TE package | [ ] | `era-construction/doc/DEMO-TE-PILOT-W1-W3.md` |
| Field checklist | [ ] | — |
| Partner / customer sign-off | [ ] | — |

---

## Sell / show rules

- Edition column copies `docs/editions/construction.yaml`.
- Sell text must not contradict the worst layer above.
- Forbidden: «ready» / «GA» while Pilot field open or Demo ❌.
- Tenancy default is **SHARED** (AC-CON-TENANT: schema+filter landed; lab two-org isolation in UAT-SMOKE). Do not claim DEDICATED unless placement was explicitly requested. AC-CON-TENANT stays out of BE rollup until field UAT closes.
