# Bank — Product Readiness Matrix (one screen)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.4  
**Purpose:** answer «readiness / can we show / pilot / sell?» for the **declared** Bank edition **and** each `banking_*` module.  
**Not the same as** [`Bank-Implementation-Matrix.md`](./Bank-Implementation-Matrix.md) (= Scaffold BE / AC only).  
**Not** [`READINESS_MATRIX.md`](../READINESS_MATRIX.md) (engineering API/DELIVERY %).  
**Not** [`Bank-Capability-Inventory.md`](./Bank-Capability-Inventory.md) (IN/PARTIAL/OUT scope boundary — use when asked «чего нет в АБС»).  
**BE waves:** [`Bank-BE-Roadmap.md`](./Bank-BE-Roadmap.md).

**Sources:** Sprint-Index · Implementation-Matrix · Capability Inventory · UAT-SMOKE · COVERAGE · Pilot · [`docs/editions/bank.yaml`](../editions/bank.yaml)

**Legend:** ✅ · 🟡 · ❌/`[ ]` · ⏸ external · `n/a`  
**Row rollup** = worst(Gate, Scaffold BE, UI, Demo/TE, Pilot lab, Pilot field) — not BE alone.  
**Line rollup** = worst across **all** module rows in § Modules × layers.

---

## Line summary (SSOT readiness)

| Edition | Gate | Scaffold BE | UI | Demo / TE | Pilot lab | Pilot field | Edition | Sell / show |
|---------|------|-------------|----|-----------|-----------|-------------|---------|-------------|
| **Bank** | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | `mvp` (`pilot_ready: false`) | **Full commercial CBS** — FC/XO lab depth shipped; YC-E adapters ready; Pilot field / `pilot_ready` ⏸ partner; ≠ ga |

Channel line: [`Bank-DBO-Product-Readiness-Matrix.md`](./Bank-DBO-Product-Readiness-Matrix.md).

---

## Modules × layers (SSOT)

Same columns as the line. Use **this** table when asking readiness of a module — not Inventory IN/OUT and not AC alone.

| Module | Gate | Scaffold BE | UI | Demo / TE | Pilot lab | Pilot field | Edition | Sell / show |
|--------|------|-------------|----|-----------|-----------|-------------|---------|-------------|
| `banking_core` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | `mvp` | lab-pilot ops / kernel |
| `banking_deposits` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | `mvp` | lab-pilot |
| `banking_loans` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | `mvp` | lab-pilot; AKB/ECL **live/cert** ⏸ |
| `banking_payments` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | `mvp` | lab-pilot; rails **live** ⏸ |
| `banking_cards` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | `mvp` | lab-pilot; gateway mock → YC-E2 |
| `banking_aml` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | `mvp` | lab-pilot; sanctions feed BLOCKED |
| `banking_treasury` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | `mvp` | lab-pilot; not markets FO |
| `banking_regreporting` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | `mvp` | lab-pilot; CBAR submit ⏸ |
| `banking_risk` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | `mvp` | lab-pilot; **methodology=lab**, not certified |
| `banking_dbo` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | `mvp` | see DBO Product-Readiness (channel) |
| `banking_trade` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | `mvp` | lab-pilot ops; SWIFT **stub** (not live) |
| `banking_collections` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | `mvp` | lab-pilot ops SoD |
| `banking_cash` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | `mvp` | lab-pilot cash desk / fees+SDB |
| `banking_islamic` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | `mvp` | lab-pilot ops; DBO read-only thin |
| `banking_wealth` | ✅ | ✅ | ✅ | ✅ | [x] | [ ] | `mvp` | lab-pilot thin custody; no FO/CSD |

**How to read**

- Scaffold BE ✅ comes from Implementation-Matrix AC for that surface (with negative path).  
- UI ✅ = ops/DBO screens in UAT-SMOKE / TE pack for that module.  
- Demo / TE and Pilot lab use Bank TE + Pilot lab signoffs (full envelope after UI waves).  
- Pilot field and edition `ga` / `pilot_ready` stay closed until YC-E7 (+ applicable live YC-E*).

---

## UI (short)

**UI class rollup:** SHOW (lab) — BANK-REF-01 snapshot is **HEADLESS** — [UI-COVERAGE-BOARD.md](./UI-COVERAGE-BOARD.md). This table is sell/show; «is there a screen?» lives on the board.

| Surface | Path | Level |
|---------|------|-------|
| Teller / ops | `era-bank` ops | ✅ lab |
| Product Factory | `/admin/product-factory` | ✅ lab |
| Risk capital / ECL | `/risk/capital`, `/risk/ecl` | ✅ lab (`methodology=lab`) |
| Cash / fees / SDB | `/cash`, `/fees` | ✅ lab |
| Payments tails | `/payments/extras` | ✅ lab |
| Collections | `/collections` | ✅ lab |
| Trade | `/trade` | ✅ lab (SWIFT stub) |
| Islamic / wealth | `/islamic`, `/wealth` | ✅ lab |
| AML cases / card disputes / 3DS ops | `/aml/cases`, `/cards/disputes`, `/cards/3ds` | ✅ lab |
| Loans deep | `/loans/applications`, `/loans/credit-lines` | ✅ lab |

**Having routes ≠ field-ready.** Sell/show: mvp Full CBS program until PARTIAL→IN + Pilot field (YC-E7).

---

## Not in this edition (must disclose)

Do **not** claim coverage for CAP-* **OUT** / **BLOCKED** in [`Bank-Capability-Inventory.md`](./Bank-Capability-Inventory.md):

| Area | Examples |
|------|----------|
| Markets FO | Derivatives FO, bond FO, full AM/brokerage/CSD |
| Channels | Own ATM switch / in-house card scheme; PFM |
| Specialized | Pension/social agency; public-sector TSA |
| Platform extras | Multi-entity holding CBS; enterprise MIS/BPM/DMS; live sanctions feed (BLOCKED) |
| Certification | Certified Basel/IFRS9 / ICAAP (CAP-RSK-CERT) |
| Live rails / SWIFT | STUB / SENT_STUB — YC-E track |

**DECLARED live (not ga):** rails, cards gateway, ASAN, AKB+certified ECL, FMN/CBAR, pentest/HA, Pilot field — [CERTIFICATION-TRACK](../../era-bank/doc/CERTIFICATION-TRACK.md).

---

## Pilot / field

| Item | Status | Evidence |
|------|--------|----------|
| Lab RT (UAT-SMOKE) — **ops-backed subset** | [x] kit | `reports/bank-pilot-lab-signoff.md` + `era-bank/doc/UAT-SMOKE.md` |
| Lab RT — **full module envelope** (UI-1…4) | [x] | UAT steps 17–24 + TE pack + `reports/bank-te-demo-signoff.md` |
| Field checklist | [ ] | YC-E7 |
| Partner / customer sign-off | [ ] | — |

Line **Pilot lab** = [x] for **lab** full envelope only — not Pilot field / not `pilot_ready`.

---

## Sell / show rules

- Edition column copies `docs/editions/bank.yaml` (`mvp`, `pilot_ready: false` until E7).
- Answer «готовность модуля» from **Modules × layers**; «готовность продукта / линии» from **Line summary**.
- Forbidden: «полная АБС» / «100% задач банка» / «GA» / certified risk / live rails / live SWIFT.
- Forbidden: claiming a live **SHARED SaaS pool** (bank or any satellite) — CAP-NFR-TOPO DECLARED; AC-BANK-TENANT 🟡 (schema+filter ≠ live pool). Same honesty as hotel/clinic TENANT. Current typical deploy = DEDICATED/ONPREM (D8 implementation).
