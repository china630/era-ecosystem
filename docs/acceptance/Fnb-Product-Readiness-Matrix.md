# F&B — Product Readiness Matrix (one screen)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.4  
**Purpose:** answer «readiness / can we show / sell?».  
**Not the same as** [`Fnb-Implementation-Matrix.md`](./Fnb-Implementation-Matrix.md) (= Scaffold BE / AC only).  
**Not** [`READINESS_MATRIX.md`](../READINESS_MATRIX.md) (engineering API/DELIVERY %).

**Sources:** Sprint-Index · Implementation-Matrix · UAT-SMOKE · COVERAGE · Pilot · [`docs/editions/fnb.yaml`](../editions/fnb.yaml)

**Legend:** ✅ · 🟡 · ❌/`[ ]` · ⏸ external · `n/a`  
**Row rollup** = worst(Gate, BE, UI, Demo/TE, Pilot lab, Pilot field) — not BE alone.

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
| Buffet planner | `/admin/buffet` (module `fnb_buffet_planner`) | 🟡 SCREEN (master Plans + composition/copy modals; UAT FB-5 open — not SHOW) |
| Outlets (multi-café) | `/admin/settings` create outlet | 🟡 SCREEN (FNB-09 / FB-OUTLET-01; UAT open — not SHOW) |
| Mutation audit (FNB-AUD-01) | `/admin/audit` + `GET /api/admin/audit` (canonical filters) | SCREEN / 🟡 — Layer A belt + viewer + path/API parity; UAT open — not SHOW. Does not move Gate, Demo, Pilot, or Sell |

Admin modal CRUD is in place for menu, tables, settings (incl. create outlet), daily-menu board, and buffet planner (master table + composition/copy); RBAC matrix is SCREEN engineering — sell/show remains 🟡 until live sign-off.

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
- Buffet Planner (`fnb_buffet_planner`, FNB-BUFFET-01) is SCREEN/API only — do not sell as Pilot-ready or GA until UAT FB-5 + Finance warehouse scope (`FIN-INV-SCOPE-01`) close.
- Mutation audit (FNB-AUD-01) is SCREEN/API — do not sell “full mutation audit” until UAT and SHOW.
