# <Product> — Product Readiness Matrix (one screen)

**Canon:** [`Product-Acceptance-Standard.md`](products/Product-Acceptance-Standard.md) §3.4  
**Purpose:** answer «readiness / can we show / sell?».  
**Not the same as** [`<Product>-Implementation-Matrix.md`](<Product>-Implementation-Matrix.md) (= Scaffold BE / AC only).

**Sources:** Sprint-Index · Implementation-Matrix · Demo/TE · Pilot checklist / Gap · editions yaml · UI map

**Legend:** ✅ · 🟡 · ❌/`[ ]` · ⏸ external · `n/a`  
**Row rollup** = worst(Gate, BE, UI, Demo/TE, Pilot lab, Pilot field) — not BE alone.

---

## Line summary (SSOT readiness)

| Edition | Gate | Scaffold BE | UI | Demo / TE | Pilot lab | Pilot field | Edition | Sell / show |
|---------|------|-------------|----|-----------|-----------|-------------|---------|-------------|
| **Edition / SKU 1** | 🟡 | 🟡 | 🟡 | ❌ | [ ] | [ ] | `mvp` | do not claim GA |
| **Edition / SKU 2** | [ ] | [ ] | n/a | n/a | [ ] | [ ] | `roadmap` | — |
| **Bundle / product** | 🟡 | 🟡 | 🟡 | ❌ | [ ] | [ ] | `mvp` not `ga` | honesty: mvp |

---

## UI (short)

| Surface | Package / path | Level |
|---------|----------------|-------|
| … | `ui/…` | 🟡 |

**Having a SPA ≠ UI ready.** Demo/TE stays 🟡 until live sign-off.

---

## Pilot / field

| Item | Status | Evidence |
|------|--------|----------|
| Lab RT | [ ] | |
| Field checklist | [ ] | |
| Partner / customer sign-off | [ ] | |

---

## Sell / show rules

- Edition column copies `editions-*.yaml` (or equivalent).
- Sell text must not contradict the worst layer above.
- Forbidden: «ready» / «GA» while Pilot field open or Demo ❌.
