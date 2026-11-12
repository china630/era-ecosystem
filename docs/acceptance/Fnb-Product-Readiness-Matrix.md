# F&B — Product Readiness Matrix (one screen)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.4  
**Purpose:** answer «readiness / can we show / sell?».  
**Not the same as** [`Fnb-Implementation-Matrix.md`](./Fnb-Implementation-Matrix.md) (= Scaffold BE / AC only).  
**Not** [`READINESS_MATRIX.md`](../READINESS_MATRIX.md) (engineering API/DELIVERY %).

**Sources:** Sprint-Index · Implementation-Matrix · UAT-SMOKE · COVERAGE · Pilot · [`docs/editions/fnb.yaml`](../editions/fnb.yaml)

**Legend:** ✅ · 🟡 · ❌/`[ ]` · ⏸ external · `n/a`  
**Row rollup** = worst(Gate, BE, UI, Demo/TE, Pilot lab, Pilot field) — not BE alone.

**Closeout (2026-11-10 access denied):** A missing screen grant opens `/access-denied`. A PIN session still returns to the floor. AC-FNB-RBAC stays 🟡. Gate / BE / UI / Demo / Pilot / Sell unchanged. Edition yaml untouched.

**Closeout (2026-11-10 settings split):** Catalog v7. `admin:master_data` is dropped. Audit, links, and limits are their own screens. Buffet cost and integration writes use the buffet and integration keys. AC-FNB-RBAC stays 🟡. Gate / BE / UI / Demo / Pilot / Sell unchanged. Edition yaml untouched.

**Closeout (2026-11-10 entity grid):** `/admin/access` is an entity × View / Change / Operate / Admin grid. Turning kitchen display off hides only the KDS screen and bump, not menu admin. FNB-RBAC-01 stays SCREEN. Gate / BE / UI / Demo / Pilot / Sell unchanged. Edition yaml untouched.

**Closeout (2026-11-05 staff cədvəl):** FNB-CEDVEL-01 SCREEN/API (not SHOW). AC-FNB-CEDVEL 🟡 out of BE rollup. Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index S-CEDVEL [~]; `fnb.yaml` untouched. Second-pass: cedvel API `denyUnlessPermission` + binding `orgUnitOptions` — no Gate/Demo/Pilot/Sell flip.

**Closeout (2026-11-09 hall till):** FNB-HALL-01 SCREEN/API (not SHOW). No Scaffold ✅ (no PRD AC). Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. Sprint-Index S-HALL [~]; `fnb.yaml` untouched.

**Closeout (2026-11-06 cedvel UX deepen):** FNB-CEDVEL-01 stays SCREEN/API (click-cell shift, week chrome, copy week) — **not SHOW**. AC-FNB-CEDVEL 🟡. Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. `fnb.yaml` untouched. Second-pass: copy replace guard — no Gate/Demo/Pilot/Sell flip.

**Closeout (2026-11-10 cedvel IA):** `/admin/cedvel` last before Settings; settings collapsed; sequential week→personnel; P2002-safe binding/week. Still SCREEN/API — **not SHOW**. AC-FNB-CEDVEL 🟡. Gate ✅ / BE ✅ / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. `fnb.yaml` untouched. Second-pass: week create race — no Gate/Demo/Pilot/Sell flip.

---

## Line summary (SSOT readiness)

| Edition | Gate | Scaffold BE | UI | Demo / TE | Pilot lab | Pilot field | Edition | Sell / show |
|---------|------|-------------|----|-----------|-----------|-------------|---------|-------------|
| **F&B** | ✅ | ✅ | 🟡 | 🟡 | [ ] | [ ] | `mvp` | do not claim GA — pilot open |

---

## UI (short)

**UI class rollup:** SCREEN — [UI-COVERAGE-BOARD.md](./UI-COVERAGE-BOARD.md). This table is sell/show; «is there a screen?» lives on the board.

| Surface | Path | Level |
|---------|------|-------|
| POS / KDS | `floor + KDS` | 🟡 |
| ERA Kafe till | `/floor` `/pin` `/m/[slug]` `/kafe` | 🟡 |
| Admin | `/admin` | 🟡 |
| Access matrix | `/admin/access` | 🟡 SCREEN (FNB-RBAC-01; not SHOW) |
| Edition + halls | `/admin/settings` (Halls modal) · orch `/settings/subscription` F&B edition card | 🟡 SCREEN (FNB-09 / FNB-10 API; browser run and UAT step open) |
| Buffet planner | `/admin/buffet/*` submenu (module `fnb_buffet_planner`) | 🟡 SCREEN (playbook: PageHeader.actions, composition modal, nav collapse; service dates `дд.мм.гггг`; date controls are `DatePicker`. Does not move Gate, UI 🟡, Demo 🟡, Pilot, or edition. UAT FB-5 unsigned — not SHOW) |
| Buffet cost attribution | `/admin/settings` (Finance web URL) + `/admin/buffet/*` · Finance `/inventory/buffet-food-cost` | 🟡 SCREEN (KPI planks; Hotel/HR via peer/orch not Settings URLs; punchlist open — not SHOW) |
| Outlets (multi-café) | `/select-outlet` + `/admin/settings` caps/shape/DELETE; Floor till-only; Buffet cap filter; pay `printChrome` | 🟡 SCREEN (FNB-09; staging RESTAURANT→NAFTANI 2026-10-29; UAT FB-OUTLET-01 open — not SHOW) |
| Mutation audit (FNB-AUD-01) | `/admin/audit` + `GET /api/admin/audit` (CatalogField incl. PosShift) | SCREEN / 🟡 — Layer A + Wave B PAY/DEFER_HUB/PosShift + Wave E compound index (2026-10-29); UAT open — not SHOW; hash-chain deferred. Does not move Gate, Demo, Pilot, or Sell |
| Staff cədvəl (FNB-CEDVEL-01) | `/admin/cedvel` (last before Settings) | SCREEN / 🟡 — WEEK_PERSON click-cell + week chrome; settings collapsed; PIN `StaffRoster` separate; UAT open — not SHOW. Does not move Gate, Demo, Pilot, or Sell |
| Nafta hall (FNB-HALL-01) | `/floor` · `/orders` · `/reports/journal` · `/reports/x` · `/admin/limits` | SCREEN / 🟡 — one till, precheck and paid slip, floor room charge, colored journal, X/handover print. UAT unsigned — not SHOW. Gate/Demo/Pilot/Sell unchanged |

Admin modal CRUD is in place for menu, tables, settings (incl. create outlet), daily-menu board, and buffet planner (submenu + composition/copy/spawn); RBAC matrix is SCREEN engineering — sell/show remains 🟡 until live sign-off.

**Having routes ≠ UI ready for sell.** Demo/TE stays 🟡 until live sign-off.

---

## Pilot / field

| Item | Status | Evidence |
|------|--------|----------|
| Lab RT (UAT-SMOKE) | [ ] | `era-fnb-pos/doc/UAT-SMOKE.md` |
| Field checklist | [ ] | — |
| Partner / customer sign-off | [ ] | — |

---

## Sell / show rules

- Edition column copies `docs/editions/fnb.yaml`.
- Sell text must not contradict the worst layer above.
- Forbidden: «ready» / «GA» while Pilot field open or Demo ❌.
- Forbidden: claiming ERA Kafe **GA** while Pilot field is open. Street café SKUs (`industry_fnb_pos`, Zal, KDS, QR) are **mvp** on the existing F&B SHARED pool; Foundation is waived until NAS.
- Edition, hall preset, and hotel mode are separate fields (ADR era-kafe-edition §1a). Upgrade ERA Kafe → full F&B adds no price line and keeps the Foundation waiver. Banquet is a stored preset without screens — do not sell banquet halls.
- Buffet Planner (`fnb_buffet_planner`, FNB-BUFFET-01) is SCREEN/API only — do not sell as Pilot-ready or GA until UAT FB-5 **signed** + Finance warehouse scope (`FIN-INV-SCOPE-01`) close. WP0–WP8 code ≠ SHOW.
- Buffet cost attribution (FNB-BUFFET-COST-01): Waves 1–6 + Phase A–D + chef-ready + WP0–WP8 **SCREEN** (C8 = future RBAC; C3 won't-do; A9 punchlist open/unsigned). Unsigned `reports/fnb-buffet-cost-lab-signoff.md` + `reports/fnb-buffet-chef-ready-punchlist.md` — do not sell residual/HYBRID; Demo ✅ only after human sign (still not Pilot/`ga`). Line rollup remains 🟡 (UI/Demo/Pilot worst layers). Gate/BE/Edition/`mvp`/Sell unchanged.
- Mutation audit (FNB-AUD-01) is SCREEN/API — do not sell “full mutation audit” until UAT and SHOW.
