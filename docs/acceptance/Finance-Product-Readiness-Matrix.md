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
| Payroll / employees | `/payroll, /employees`, `/hr/emas-queue` | 🟡 — ƏMAS manual queue + extension prefill STUB (`FIN-EMAS-01`); not sell-ready without portal UAT |
| FA / reporting | `/fixed-assets, /reporting/*` | 🟡 |
| Multi-GAAP mapping | `/accounting/ledger-mappings` | 🟡 |
| IFRS chart / adj / close | `/accounting/chart`, adjustments, reporting close | 🟡 |
| Accounting books / compare | `/accounting/books`, `/reporting/compare-books` | 🟡 — Wave 5 eng (ops freeze + MgmtLaborDelta): [evrostar-wave-5](../runbooks/evrostar-wave-5.md); COVERAGE FIN-BOOK-MGMT-01 = API not SHIPPED |
| Invoice extra fields | `/settings/extra-fields` + invoice modal | 🟡 — W1 SCREEN; not sell; extras never post GL |
| Invoice register saved views | `/sales/invoices` filters + named views | 🟡 — W2 SCREEN; not sell; not SQL / not СКД |
| Commercial invoice print | `/print/invoice/:id` + modal Print + `/settings/print-placeholders` | 🟡 — W3 SCREEN; not sell; not fiscal/e-qaimə |
| CP grant doors (Wave 5) | Finance `can()` + Nest `PermissionsGuard`; matrix = Orch `/settings/access` | 🟡 — FIN-RBAC-01 SCREEN; AC-FIN-RBAC out of BE rollup; not SHOW |

**Having routes ≠ UI ready for sell.** Demo/TE stays ❌ until live sign-off.

**FIN-GAAP engineering (2026-09):** Waves A–C + thin edges + structural tails eng-complete per [ADR residuals](../adr/finance-accounting-book.md) (selector, slots, wizard CoA strategies, multi-target mirror, book-scoped reports/exports/FY close, holdings `bookCode`, account uniqueness per book, Audit Hub ops vs non-ops). UI 🟡 / Demo/Pilot unchanged until Lab RT. Do not treat older agent “remaining gaps” lists as SSOT. Lab paths: [UAT-SMOKE](../../era-finance-core/doc/UAT-SMOKE.md).

**Trade credit control:** Phase 0–1 + **Phase 2 eng** (2a PWA/QR `/buyer`, 2b enrich meter, 2c pay-link + factor lead referral) + **Phase 3 eng** (working-capital `suggestedLimit` / `proposedKind` / decision log — finance-only; never auto WC). SKUs `trade_credit_control` / `trade_credit_factor_lead`. **No Pilot** / not sell/show / not `ga` until Lab RT. ADR: [finance-trade-credit-control.md](../adr/finance-trade-credit-control.md), [finance-trade-credit-factor-lead.md](../adr/finance-trade-credit-factor-lead.md).

---

## Pilot / field

| Item | Status | Evidence |
|------|--------|----------|
| Lab RT (UAT-SMOKE) | [ ] | Path documented + deny/unit automation; **human Lab RT signoff pending** before Pilot `[x]` |
| Field checklist | [ ] | — |
| Partner / customer sign-off | [ ] | — |
| Multi-GAAP eng. suite | ✅ | Jest FIN-GAAP suite (Phase 0 gate for Wave A) |

---

## Sell / show rules

- Edition column copies `docs/editions/finance.yaml`.
- Sell text must not contradict the worst layer above.
- Forbidden: «ready» / «GA» while Pilot field open or Demo ❌.
- Forbidden: implying Finance SSO/env is fully orch-owned desired state for sell — AC-FIN-CFG Scaffold ✅ (negative proof); Pilot/UI still open. Dedicated finance ≠ new schema without `organizationId`.
