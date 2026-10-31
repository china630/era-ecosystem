# Finance — Product Readiness Matrix (one screen)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.4  
**Purpose:** answer «readiness / can we show / sell?».  
**Not the same as** [`Finance-Implementation-Matrix.md`](./Finance-Implementation-Matrix.md) (= Scaffold BE / AC only).  
**Not** [`READINESS_MATRIX.md`](../READINESS_MATRIX.md) (engineering API/DELIVERY %).

**Sources:** Sprint-Index · Implementation-Matrix · UAT-SMOKE · COVERAGE · Pilot · [`docs/editions/finance.yaml`](../editions/finance.yaml)

**Legend:** ✅ · 🟡 · ❌/`[ ]` · ⏸ external · `n/a`  
**Row rollup** = worst(Gate, BE, UI, Demo/TE, Pilot lab, Pilot field) — not BE alone.

**Closeout (2026-10-31):** Finance home FX may show the previous CBAR day until today's FINAL exists. Postings stay on the document date. Direct bank sync stays off until `bankingDirect.syncMode` is `mock` or `rest`. Taxpayer and signature stubs stay off unless `settings.tax.taxLookupMock` or `signatureGatewayMock` is set. FIN-ASAN-01 stays API/STUB. VAT-threshold audit rows now take a chain hash; AC-FIN-AUD stays 🟡. The home close prompt offers the earliest unclosed past month. Rejected hotel day documents are under Reports, not the warehouse; the row opens the package lines, with quantity purpose labeled. Gate / BE / UI / Demo / Pilot / Sell unchanged — do **not** claim GA; edition stays `mvp`.

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
| GL / invoices / adjustments | `/chart-of-accounts`, `/sales/invoices`, `/accounting/adjustments` | 🟡 — due dates render `дд.мм.гггг` |
| P&L and trial-balance profit proxy | `/reporting` sums `601` with `601.*` (AC-FIN-DAY) | 🟡 — same reports; not a new SHOW |
| Payroll / employees | `/payroll, /employees`, `/hr/emas-queue` | 🟡 — ƏMAS manual queue + extension prefill STUB (`FIN-EMAS-01`); wave 11 minute premiums API (`FIN-HR-MIN-01`); not sell-ready without portal UAT |
| FA / reporting | `/fixed-assets, /reporting/*` | 🟡 |
| Multi-GAAP mapping | `/accounting/ledger-mappings` | 🟡 |
| IFRS chart / adj / close | `/accounting/chart`, adjustments, reporting close | 🟡 |
| Accounting books / compare | `/accounting/books`, `/reporting/compare-books` | 🟡 — Wave 5 eng (ops freeze + MgmtLaborDelta): [evrostar-wave-5](../runbooks/evrostar-wave-5.md); COVERAGE FIN-BOOK-MGMT-01 = API not SHIPPED |
| Invoice extra fields | `/settings/extra-fields` + invoice modal | 🟡 — W1 SCREEN; not sell; extras never post GL |
| Invoice register saved views | `/sales/invoices` filters + named views | 🟡 — W2 SCREEN; not sell; not SQL / not СКД |
| Commercial invoice print | `/print/invoice/:id` + modal Print + `/settings/print-placeholders` | 🟡 — W3 SCREEN; not sell; not fiscal/e-qaimə |
| CP grant doors (Wave 5) | Finance `can()` + Nest `PermissionsGuard`; matrix = Orch `/settings/access` | 🟡 — FIN-RBAC-01 SCREEN; AC-FIN-RBAC out of BE rollup; not SHOW |
| Reference Excel | `/settings/reference-data` | 🟡 — FC-REF-01 SCREEN; upload stays in this org; UAT open; not SHOW |
| Simplified-tax watch | `/reporting/tax-export`, org settings regime, SuperAdmin `/admin/data/tax-schemes` | 🟡 — SCREEN; FIN-TAX-SCHEME-01 API; AC-FIN-TAX-SCHEME 🟡 out of W6 BE rollup; does not post or switch regime; not SHOW |
| e-qaimə day close | org settings checkbox, `/sales/invoices` list and invoice card, hotel `/night-audit` gap list and check-day stop | 🟡 — SCREEN; FIN-EQAIME-DAY-01 API; AC-FIN-EQAIME-DAY 🟡 out of W6 BE rollup; does not enable S2S; not SHOW |
| Fact queue | `/reporting/fact-queue` meaning list; `/reporting` and dashboard close count; period-lock date refuses the same month | 🟡 — SCREEN; FIN-FACT-QUEUE-01 API; AC-FIN-FACT-QUEUE 🟡 out of W6 BE rollup; does not extend AC-FIN-GL; not SHOW |
| Provisional VAT | `/purchases` waiting-document status, document number on the purchase form, later credit link; `/sales/invoices` create lists the scheme VAT percent; `/reporting/tax-export` scheme-driven recalc or amendment draft; period-lock date refuses the same month | 🟡 — SCREEN; FIN-PROVISIONAL-VAT-01 API; AC-FIN-PROVISIONAL-VAT 🟡 out of W6 BE rollup; whole purchase stays in expense until the document; exempt line sent to the API is refused; no cash refund; does not extend AC-FIN-TAX; not SHOW |
| Mutation audit (FIN-AUD-01) | `/admin/audit` + `GET /api/admin/audit` (CatalogField entityType + EraListFilterBar + kit DatePicker; canonical filters incl. entityId); OWNER `/admin/security-audit` + `GET /api/admin/security-audit` (same filter kit; CatalogField entityName + All) | 🟡 — COVERAGE SHIPPED (Nest Layer A); Wave C kit-align + Wave D journal UI parity (+ security-audit sibling) 2026-10-29; AC-FIN-AUD 🟡 AuthZ-negatives residual out of W6. Does not move Gate, Demo ❌, Pilot, or Sell |

**Having routes ≠ UI ready for sell.** Demo/TE stays ❌ until live sign-off.

**Tax scheme watcher (2026-10-24):** the screen row above does not move Gate, Scaffold BE, Demo, Pilot, or Sell. Edition stays `mvp`. AC-FIN-TAX is not extended.

**e-qaimə day close (2026-10-24):** the checkbox and the hotel gap list do not move Gate, Scaffold BE, Demo, Pilot, or Sell. Edition stays `mvp`. `FIN-EQAIME-01` stays STUB/API.

**Fact queue (2026-10-24):** the meaning list does not move Gate, Scaffold BE, Demo, Pilot, or Sell. Edition stays `mvp`. AC-FIN-GL is not extended.

**Provisional VAT (2026-10-24):** the waiting-document status, the scheme VAT rate on invoice create, and the amendment draft do not move Gate, Scaffold BE, Demo, Pilot, or Sell. Edition stays `mvp`. AC-FIN-TAX is not extended. A cash refund is not in this slice. The on-prem package is the same statutory row and has no extra screen.

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

## Cross-product (not Finance sell)

- **F&B buffet food cost run** (HYBRID/residual, warehouse classes FOOD/CHEM/…): ADR [fnb-buffet-cost-attribution.md](../adr/fnb-buffet-cost-attribution.md) · [chef-ready backlog](../adr/fnb-buffet-chef-ready-backlog.md); Waves 5–6 + Phase A–D + chef-ready Finance SCREEN `/inventory/buffet-food-cost` — outlet CatalogField, mismatch banner, SKU variance, Print, INVENTORY_GT hide-until-WH, `#warehouses`→FOOD filter, ISSUES_ONLY → audits/settings; lab seed + unsigned punchlist. UAT open — **not SHOW / not sell**. Does not move Finance Gate/BE/Pilot/edition.

## Sell / show rules

- Edition column copies `docs/editions/finance.yaml`.
- Sell text must not contradict the worst layer above.
- Forbidden: «ready» / «GA» while Pilot field open or Demo ❌.
- Forbidden: implying Finance SSO/env is fully orch-owned desired state for sell — AC-FIN-CFG Scaffold ✅ (negative proof); Pilot/UI still open. Dedicated finance ≠ new schema without `organizationId`.
