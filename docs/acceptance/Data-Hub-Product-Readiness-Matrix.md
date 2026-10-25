# Data Hub — Product Readiness Matrix (one screen)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.4  
**Purpose:** answer «readiness / can we show / sell?».  
**Not the same as** [`Data-Hub-Implementation-Matrix.md`](./Data-Hub-Implementation-Matrix.md) (= Scaffold BE / AC only).  
**Not** [`READINESS_MATRIX.md`](../READINESS_MATRIX.md) (engineering API/DELIVERY %).

**Sources:** Sprint-Index · Implementation-Matrix · UAT-SMOKE · COVERAGE · Pilot · [`docs/editions/data-hub.yaml`](../editions/data-hub.yaml)

**Legend:** ✅ · 🟡 · ❌/`[ ]` · ⏸ external · `n/a`  
**Row rollup** = worst(Gate, BE, UI, Demo/TE, Pilot lab, Pilot field) — not BE alone.

**Closeout (2026-10-23):** Scaffold BE **🟡** because AC-DH-POL (per-catalog fetch + FX codes) has no negative spec. REG/FX/BANK/HS stay ✅. VOEN stays excluded (e-taxes BLOCKED). Hub process is still HEADLESS; the settings screen is orchestrator `/super-admin/reference` (SCREEN, UAT open). Do **not** claim GA; edition stays `mvp`.

---

## Line summary (SSOT readiness)

| Edition | Gate | Scaffold BE | UI | Demo / TE | Pilot lab | Pilot field | Edition | Sell / show |
|---------|------|-------------|----|-----------|-----------|-------------|---------|-------------|
| **Data Hub** | ✅ | 🟡 | n/a | 🟡 | [ ] | [ ] | `mvp` | do not claim GA — API product; pilot/field open; policy AC 🟡 |

---

## UI (short)

**UI class rollup:** HEADLESS — [UI-COVERAGE-BOARD.md](./UI-COVERAGE-BOARD.md). This table is sell/show; «is there a screen?» lives on the board.

| Surface | Path | Level |
|---------|------|-------|
| Ops UI | `n/a — API-only Nest service` | n/a |
| Swagger registry | `/registry/v1/docs` | 🟡 |
| Settings screen | orchestrator `/super-admin/reference` (not a hub app) | SCREEN — UAT open; not SHOW |

**Having routes ≠ UI ready for sell.** Demo/TE stays 🟡 until live sign-off. HEADLESS lines use `n/a` with reason.

---

## Pilot / field

| Item | Status | Evidence |
|------|--------|----------|
| Lab RT (UAT-SMOKE) | [ ] | `era-data-hub/doc/UAT-SMOKE.md` |
| Field checklist | [ ] | — |
| Partner / customer sign-off | [ ] | — |

---

## Sell / show rules

- Edition column copies `docs/editions/data-hub.yaml`.
- Sell text must not contradict the worst layer above.
- Forbidden: «ready» / «GA» while Pilot field open or Demo ❌.
