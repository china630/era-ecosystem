# Bank DBO — Product Readiness Matrix (one screen)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.4  
**Purpose:** answer «readiness / can we show / sell?» for the **DBO channel** edition.  
**Not the same as** [`Bank-DBO-Implementation-Matrix.md`](./Bank-DBO-Implementation-Matrix.md).  
**Parent scope boundary:** [`Bank-Capability-Inventory.md`](./Bank-Capability-Inventory.md) (channel cannot imply OUT CBS modules).

**Sources:** Sprint-Index · Implementation-Matrix · UAT-SMOKE · COVERAGE · Pilot · [`docs/editions/bank-dbo.yaml`](../editions/bank-dbo.yaml)

**Legend:** ✅ · 🟡 · ❌/`[ ]` · ⏸ external · `n/a`  
**Row rollup** = worst(Gate, BE, UI, Demo/TE, Pilot lab, Pilot field) — not BE alone.

---

## Line summary (SSOT readiness)

| Edition | Gate | Scaffold BE | UI | Demo / TE | Pilot lab | Pilot field | Edition | Sell / show |
|---------|------|-------------|----|-----------|-----------|-------------|---------|-------------|
| **Bank DBO** | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | `mvp` (`pilot_ready: false`) | lab-pilot **channel** over Bank CBS; ASAN stub; ≠ full digital bank suite |

---

## UI (short)

| Surface | Path | Level |
|---------|------|-------|
| Retail login / dashboard | `/login`, `/dashboard` | ✅ lab (ASAN stub badge) |
| Accounts / transfers / payments | `/accounts`, `/transfers`, `/payments` | ✅ lab |
| Standing orders | `/standing-orders` | ✅ lab |
| Loan apply | `/loans/apply` | ✅ lab (submit only) |
| 3DS challenge | `/cards/3ds` | ✅ lab |
| Islamic (read-only) | `/islamic` | ✅ lab thin |
| Corporate approve | `/payments/approve` | ✅ lab |

---

## Not in this edition (channel + parent)

| Area | Status |
|------|--------|
| Live ASAN İmza / SİMA | DECLARED (YC-E3) — stub labeled in UI |
| Live payment rails behind DBO payments | DECLARED (parent YC-E1) |
| Open Banking full AIS/PIS | PARTIAL / OUT depth |
| PFM / chat banking / H2H corporate files | OUT (Capability Inventory) |
| Any parent CAP-* OUT (trade, custody, wealth, …) | **Not included** via DBO |

---

## Pilot / field

| Item | Status | Evidence |
|------|--------|----------|
| Lab RT (UAT-SMOKE) | [x] | `reports/bank-dbo-pilot-lab-signoff.md` |
| Field checklist | [ ] | YC-E7 |
| Partner / customer sign-off | [ ] | — |

---

## Sell / show rules

- Edition column copies `docs/editions/bank-dbo.yaml`.
- Forbidden: «GA» / live gov-sign / implying full CBS modules while channel mvp and parent OUT inventory stand.
