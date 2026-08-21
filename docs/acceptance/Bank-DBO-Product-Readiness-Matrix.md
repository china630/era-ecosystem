# Bank DBO — Product Readiness Matrix (one screen)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.4  
**Purpose:** answer «readiness / can we show / sell?» for the **DBO channel** edition.  
**Not the same as** [`Bank-DBO-Implementation-Matrix.md`](./Bank-DBO-Implementation-Matrix.md).  
**Parent scope boundary:** [`Bank-Capability-Inventory.md`](./Bank-Capability-Inventory.md) (channel cannot imply OUT CBS modules).

**Sources:** Sprint-Index · Implementation-Matrix · UAT-SMOKE · COVERAGE · Pilot · [`docs/editions/bank-dbo.yaml`](../editions/bank-dbo.yaml)

**Legend:** ✅ · 🟡 · ❌/`[ ]` · ⏸ external · `n/a`  
**Row rollup** = worst(Gate, BE, UI, Demo/TE, Pilot lab, Pilot field) — not BE alone.

**Closeout (2026-08-18):** AC-DBO-OPEN is **in** Scaffold BE rollup → **BE 🟡**. Code stretch (curl-only), not vendor. Return checklist: [BE-OPEN-AND-TOPO-RETURN.md](./BE-OPEN-AND-TOPO-RETURN.md). Sell unchanged — ≠ full digital bank; edition `mvp` / `pilot_ready: false`.

---

## Line summary (SSOT readiness)

| Edition | Gate | Scaffold BE | UI | Demo / TE | Pilot lab | Pilot field | Edition | Sell / show |
|---------|------|-------------|----|-----------|-----------|-------------|---------|-------------|
| **Bank DBO** | ✅ | 🟡 | ✅ | ✅ | [x] | [ ] | `mvp` (`pilot_ready: false`) | lab-pilot **channel** over Bank CBS; ASAN stub; ≠ full digital bank; OPEN in BE rollup (curl-only) |

---

## UI (short)

**UI class rollup:** SHOW (lab) — Open API keys now **SCREEN** (`/open-api`) — [UI-COVERAGE-BOARD.md](./UI-COVERAGE-BOARD.md). This table is sell/show; «is there a screen?» lives on the board.

| Surface | Path | Level |
|---------|------|-------|
| Retail login / dashboard | `/login`, `/dashboard` | ✅ lab (ASAN stub badge) |
| Accounts / transfers / payments | `/accounts`, `/transfers`, `/payments` | ✅ lab |
| Standing orders | `/standing-orders` | ✅ lab |
| Loan apply | `/loans/apply` | ✅ lab (submit only) |
| 3DS challenge | `/cards/3ds` | ✅ lab |
| Islamic (read-only) | `/islamic` | ✅ lab thin |
| Corporate approve | `/payments/approve` | ✅ lab |
| Open API keys (corporate) | `/open-api` | 🟡 SCREEN — create/revoke; Scaffold BE still 🟡 ([return playbook](./BE-OPEN-AND-TOPO-RETURN.md)) |

Retail/corporate screens are lab-green. Open API keys are **SCREEN** (not in the UI ✅ sell claim). Scaffold BE stays 🟡.

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
- Forbidden: «SHARED bank SaaS pool» — AC-BANK-TENANT 🟡; CAP-NFR-TOPO DECLARED (parent).
