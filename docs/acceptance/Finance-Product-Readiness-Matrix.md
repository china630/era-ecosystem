# Finance — Product Readiness Matrix (one screen)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.4  
**Purpose:** answer «readiness / can we show / sell?».  
**Not the same as** [`Finance-Implementation-Matrix.md`](./Finance-Implementation-Matrix.md) (= Scaffold BE / AC only).  
**Not** [`READINESS_MATRIX.md`](../READINESS_MATRIX.md) (engineering API/DELIVERY %).

**Sources:** Sprint-Index · Implementation-Matrix · UAT-SMOKE · COVERAGE · Pilot · [`docs/editions/finance.yaml`](../editions/finance.yaml)

**Legend:** ✅ · 🟡 · ❌/`[ ]` · ⏸ external · `n/a`  
**Row rollup** = worst(Gate, BE, UI, Demo/TE, Pilot lab, Pilot field) — not BE alone.

**Closeout (2026-08-17 Green Scaffold BE Wave 6):** Scaffold BE ✅. UI / Demo / Pilot / Sell unchanged — do **not** claim GA; edition stays `mvp`.

---

## Line summary (SSOT readiness)

| Edition | Gate | Scaffold BE | UI | Demo / TE | Pilot lab | Pilot field | Edition | Sell / show |
|---------|------|-------------|----|-----------|-----------|-------------|---------|-------------|
| **Finance** | ✅ | ✅ | 🟡 | ❌ | [ ] | [ ] | `mvp` | do not claim GA — many FIN-* API-only |

---

## UI (short)

**UI class rollup:** SCREEN — [UI-COVERAGE-BOARD.md](./UI-COVERAGE-BOARD.md). This table is sell/show; «is there a screen?» lives on the board.

| Surface | Path | Level |
|---------|------|-------|
| GL / invoices / adjustments | `/chart-of-accounts`, `/sales/invoices`, `/accounting/adjustments` | 🟡 |
| Payroll / employees | `/payroll, /employees` | 🟡 |
| FA / reporting | `/fixed-assets, /reporting/*` | 🟡 |

**Having routes ≠ UI ready for sell.** Demo/TE stays ❌ until live sign-off.

---

## Pilot / field

| Item | Status | Evidence |
|------|--------|----------|
| Lab RT (UAT-SMOKE) | [ ] | `era-finance-core/doc/UAT-SMOKE.md` deny paths automated; lab RT signoff pending |
| Field checklist | [ ] | — |
| Partner / customer sign-off | [ ] | — |

---

## Sell / show rules

- Edition column copies `docs/editions/finance.yaml`.
- Sell text must not contradict the worst layer above.
- Forbidden: «ready» / «GA» while Pilot field open or Demo ❌.
- Forbidden: implying Finance SSO/env is fully orch-owned desired state for sell — AC-FIN-CFG Scaffold ✅ (negative proof); Pilot/UI still open. Dedicated finance ≠ new schema without `organizationId`.
