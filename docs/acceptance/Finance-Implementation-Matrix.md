# Finance — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Finance-Product-Readiness-Matrix.md`](./Finance-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

**BE deepen (2026-08-17):** Green Scaffold BE Wave 6 — `__tests__/fin-*-negative.spec.ts` (GL/ARAP/INV/EVT/CFG/HR/TAX/FA).

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-FIN-GL | GL / NAS / journal posting | ✅ | [ ] | `__tests__/fin-gl-negative.spec.ts` | Negative: unbalanced journal; closed period; lockedPeriodUntil; **manual voucher**: short reason; USER denied; foreign counterparty; **AR template without CP**. Catalog: Q-01 commercial kassa **221** / bank **223** (not NAS-GOV 101); `PostingRole` maps per kind |
| AC-FIN-ARAP | AR/AP invoices + payment/netting | ✅ | [ ] | `__tests__/fin-arap-negative.spec.ts` | Negative: foreign counterparty netting; over-max net; overpay refuse; **credit-adjustment**: amount > remaining; PAID/CANCELLED; short reason; **REVENUE VAT 601/545/211**; EXPENSE no 545 |
| AC-FIN-INV | Inventory + stock/GL atomicity | ✅ | [ ] | `__tests__/fin-inv-negative.spec.ts` | Negative: stock+GL rollback when journal fails inside `$transaction` |
| AC-FIN-HR | HR payroll depth + MDM person read-through | ✅ | [ ] | `__tests__/fin-hr-negative.spec.ts`; `emas-wave7.spec.ts`; `payroll-minute-premiums.spec.ts` | Negative: USER denied payroll finance (OWNER/ACCOUNTANT only). UI depth still 🟡 in Readiness. **Step 5:** Employee name SoR = MDM parts. **Evrostar wave 7:** `emasMode` + PENDING_MANUAL queue (`FIN-EMAS-01` = STUB) — [evrostar-wave-7.md](../runbooks/evrostar-wave-7.md). **Wave 11:** CP minute buckets → premiums (`FIN-HR-MIN-01` = API) — [evrostar-wave-11.md](../runbooks/evrostar-wave-11.md). **P1:** TRANSFER enqueue + Excel→queue markSubmitted + terminate CTA→CP — Demo/Pilot unchanged |
| AC-FIN-TAX | Tax / Goskomstat statforms | ✅ | [ ] | `__tests__/fin-tax-negative.spec.ts` | Negative: invalid VÖEN length on taxpayer lookup |
| AC-FIN-TAX-SCHEME | Dated scheme + simplified-tax watcher | 🟡 | [ ] | `simplified-tax-watch.spec.ts` | Negative: pre-2026 card is not 6%; cash/bank are not ×0.5; unmarked card is neither; e-qaimə share over 30% marks prices and posts nothing. **Out of W6 BE rollup.** COVERAGE FIN-TAX-SCHEME-01 = API, not SHIPPED. Does **not** extend AC-FIN-TAX. |
| AC-FIN-EQAIME-DAY | Night audit stays open without an e-qaimə number | 🟡 | [ ] | `qaime-day-close.spec.ts`; hotel `qaime-day-close-gate.spec.ts` | Negative: rule off does not block; registered invoice without a number blocks; a blank number blocks; population invoice does not; a manual number does not block and is not sent again; link does not submit and S2S off stays 503. Check-day stops with the same rule. **Out of W6 BE rollup.** COVERAGE FIN-EQAIME-DAY-01 = API, not SHIPPED. Does **not** extend AC-FIN-TAX or repaint FIN-EQAIME-01. |
| AC-FIN-FACT-QUEUE | Month close stays open while money has no meaning | 🟡 | [ ] | `fact-queue.spec.ts` | Negative: unmatched bank blocks close; a chosen meaning does not; posted cash without a meaning blocks; a cash order already tied to a payment does not; a manual journal does not clear the row; an open-month posting is still allowed; a founder is not a supplier and a supplier is not a loan until confirmed. The period-lock date uses the same refusal. **Out of W6 BE rollup.** COVERAGE FIN-FACT-QUEUE-01 = API, not SHIPPED. Does **not** extend AC-FIN-GL. |
| AC-FIN-PROVISIONAL-VAT | Provisional 18% and a filed-period amendment | 🟡 | [ ] | `provisional-vat.spec.ts` | Negative: no document posts the whole purchase to expense, not inventory or input VAT; a linked document moves goods to inventory and the tax against output VAT with no cash; the invoice rate list is the scheme percent only and a line sent as exempt is refused; the recalc reads the scheme and the saved export amount; an equal amount stays unchanged; `GENERATED` is recalculated in place; `CONFIRMED_BY_TAX` keeps the old amount and drafts the difference; a non-retroactive higher tax does not raise the filed figure; `closePeriod` and the period-lock date refuse until the draft is marked sent. **Out of W6 BE rollup.** COVERAGE FIN-PROVISIONAL-VAT-01 = API, not SHIPPED. Specs not executed. Does **not** extend AC-FIN-TAX. |
| AC-FIN-FA | Fixed + intangible assets | ✅ | [ ] | `__tests__/fin-fa-negative.spec.ts` | Negative: dispose refuses already DISPOSED asset; **DONATION** acquire without note ≥10 |
| AC-FIN-EVT | Satellite event ingress → accounting dispatch | ✅ | [ ] | `__tests__/fin-evt-negative.spec.ts` | Negative: InternalServiceTokenGuard 401 without/wrong Bearer; fail-closed in production |
| AC-FIN-CFG | Desired-state SSO / service tokens from orchestrator (no compose folklore) | ✅ | [ ] | `__tests__/fin-cfg-negative.spec.ts` | Negative: runtime-config without Bearer → 401; short `ssoSharedSecret` rejected by DTO |
| AC-FIN-GAAP | Multi-GAAP NAS→IFRS + AccountingBook Waves A–C engineering slice + Wave D ops freeze/delta eng | 🟡 | [ ] | integrity + per-book + CF specs; multi-target mirror and Audit Hub specs; `accounting-book.spec.ts`; `compare-books.spec.ts`; `wave5-ops-mgmt.spec.ts`; `wave5-mgmt-delta.spec.ts`; UAT-SMOKE FIN-GAAP/FIN-BOOK | PARTIAL until UAT. Wave **D** eng in Wave 5 (ops freeze + MgmtLaborDelta) — COVERAGE FIN-BOOK-MGMT-01 = API not SHIPPED. Multi-target PUBLISHED-set fan-out, per-book idempotency/outcomes, and default-ops vs ACTIVE non-ops Audit Hub presence/debit parity are covered; remaining report/close edges and Lab RT remain. [ADR AccountingBook](../adr/finance-accounting-book.md) + [evrostar-wave-5.md](../runbooks/evrostar-wave-5.md). |
| AC-FIN-TCC | Trade credit lock + policy + Phase 2–3 eng | 🟡 | [ ] | `trade-credit.service.spec.ts`; classifier/limit/policy/leak/phase2 specs; wholesale `ws-credit-negative.spec.ts`; orch `buyer-portal-negative.spec.ts` | Phase 0–3 eng (incl. WC suggested limit). Negatives: SKU 402; no policyGroup/suggestedLimit/proposedKind buyer/wholesale; pin D; enrich optional D; factor SKU gate; WC never auto-apply. COVERAGE FIN-TCC-01..05 API. **Not** Scaffold ✅ until Lab RT. ADR finance-trade-credit-control + finance-trade-credit-factor-lead |
| AC-FIN-EXT | Invoice extra fields (SaaS core, not СКД) | 🟡 | [ ] | `test/extra-fields/extra-fields.service.spec.ts`; kit `extra-attributes.test.ts` | W1: registry + JSONB on Invoice; unknown key 400; not GL. **Out of W6 BE rollup.** ADR extensibility-forms-print-reports |
| AC-FIN-VIEW | Invoice register saved views (SaaS core, not СКД) | 🟡 | [ ] | `test/saved-list-views/saved-list-views.service.spec.ts`; kit `saved-list-view.test.ts` | W2: whitelist columns/filters/sort; no JSONB extra filters; not SQL. ADR extensibility-forms-print-reports |
| AC-FIN-PRINT | Commercial invoice print snapshot (SaaS core, not fiscal) | 🟡 | [ ] | `test/invoices/invoice-print-snapshot.spec.ts`; kit `print-snapshot.test.ts` | W3: flat placeholders + one lines loop; vendor HTML; not KO-1/e-qaimə. ADR extensibility-forms-print-reports |
| AC-FIN-RBAC | Finance consumes CP JWT grants (`api:*` / `admin:*` / `screen:*`) | 🟡 | [ ] | UAT-SMOKE § FIN-RBAC-01; ADR finance-domain-permissions-and-rbac; `rbac-bridge-sprint.spec.ts` (auditor belt) | **Out of BE rollup.** Door = `PermissionsGuard` keys (Post/Approve = `api:ledger.post`). No Finance matrix UI. SCREEN until field UAT — not SHOW/GA. Do **not** flip AC-FIN-GL. |
| AC-FIN-REF | Org Excel copy of FX, banks, calendar, HS | 🟡 | [ ] | `reference-manual.controller.ts`; COVERAGE FC-REF-01 | **Out of W6 BE rollup.** No negative spec for a bad workbook. Reads cover FX spot/range/convert and calendar day/range/business days. Does not write the hub. SCREEN until UAT. Do **not** flip AC-FIN-GL or the finance BE ✅ rollup. |
| AC-FIN-DAY | Hotel day document v2: article VAT, leaf post, `601.*` rollup, uncosted qty | 🟡 | [ ] | ADR hotel-revenue-code-resolution; HOT-REV-01 | **Out of W6 BE rollup.** No negative spec (group account, zero average, house-use qty). Reports already on screen. Does **not** flip AC-FIN-GL, AC-FIN-EVT, or the finance BE ✅ rollup. |

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs) → **✅**.  
**AC-FIN-RBAC, AC-FIN-REF, AC-FIN-DAY, AC-FIN-TAX-SCHEME, AC-FIN-EQAIME-DAY, AC-FIN-FACT-QUEUE, and AC-FIN-PROVISIONAL-VAT are out of Scaffold BE rollup** (SCREEN / UAT open, or API-only watcher) — they do not darken BE ✅ and do not flip AC-FIN-GL or AC-FIN-TAX.  
Do not call this table «product readiness».

**SaaS Wave 3 (audit only):** Finance already request-tenants via Nest `TenantContextInterceptor` + membership ALS from JWT. Wave 3 did **not** port kit `enterSatelliteTenant`. No silent process-bind stamps via kit in production paths.
### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| Pilot lab / field | UAT signoff / customer | Out of BE plan | Owned by UI/lab plan |
| UI / Demo depth | Payroll / FA surfaces | Out of BE plan | Product-Readiness UI 🟡 · Demo ❌ |
| AC-FIN-RBAC | Field UAT deny paths + SHOW claim | Code | Out of BE rollup (🟡 SCREEN) |
| AC-FIN-TAX-SCHEME | No UAT; a guest hotel card payment and a card deposit refund with no company VÖEN are tagged; a company card, bank transfer, and cash stay unmarked; watcher does not post | Code | Out of BE rollup (🟡 API) |
| AC-FIN-EQAIME-DAY | No UAT; does not enable S2S; clinic and F&B have no night-audit gate | Code | Out of BE rollup (🟡 API) |
| AC-FIN-FACT-QUEUE | No UAT; does not block open-month posting; clinic and hotel night audit are not this gate | Code | Out of BE rollup (🟡 API) |
| AC-FIN-PROVISIONAL-VAT | No UAT; no cash refund; no live amendment send; does not extend AC-FIN-TAX | Code | Out of BE rollup (🟡 API) |

### Negative-path proof index

| Suite | AC |
|-------|----|
| `era-finance-core/apps/api/__tests__/fin-gl-negative.spec.ts` | AC-FIN-GL |
| `era-finance-core/apps/api/__tests__/fin-arap-negative.spec.ts` | AC-FIN-ARAP |
| `era-finance-core/apps/api/__tests__/fin-inv-negative.spec.ts` | AC-FIN-INV |
| `era-finance-core/apps/api/__tests__/fin-evt-negative.spec.ts` | AC-FIN-EVT |
| `era-finance-core/apps/api/__tests__/fin-cfg-negative.spec.ts` | AC-FIN-CFG |
| `era-finance-core/apps/api/__tests__/fin-hr-negative.spec.ts` | AC-FIN-HR |
| `era-finance-core/apps/api/__tests__/fin-tax-negative.spec.ts` | AC-FIN-TAX |
| `era-finance-core/apps/api/src/reporting/simplified-tax-watch.spec.ts` | AC-FIN-TAX-SCHEME (out of BE rollup) |
| `era-finance-core/apps/api/src/invoices/qaime-day-close.spec.ts` | AC-FIN-EQAIME-DAY (out of BE rollup) |
| `era-finance-core/apps/api/src/reporting/fact-queue.spec.ts` | AC-FIN-FACT-QUEUE (out of BE rollup) |
| `era-finance-core/apps/api/src/reporting/provisional-vat.spec.ts` | AC-FIN-PROVISIONAL-VAT (out of BE rollup) |
| `era-hotel-pms/__tests__/qaime-day-close-gate.spec.ts` | AC-FIN-EQAIME-DAY (out of BE rollup) |
| `era-finance-core/apps/api/__tests__/fin-fa-negative.spec.ts` | AC-FIN-FA |
| `era-finance-core/apps/api/test/rbac/rbac-bridge-sprint.spec.ts` | AC-FIN-RBAC (auditor belt) |
| `era-finance-core/apps/api/test/trade-credit/trade-credit.service.spec.ts` | AC-FIN-TCC |
| `era-finance-core/apps/api/test/trade-credit/trade-credit-classifier.spec.ts` | AC-FIN-TCC |
| `era-finance-core/apps/api/test/trade-credit/trade-credit-limit.spec.ts` | AC-FIN-TCC |
| `era-finance-core/apps/api/test/trade-credit/trade-credit-policy.apply.spec.ts` | AC-FIN-TCC |
| `era-finance-core/apps/api/test/trade-credit/trade-credit-policy-leak.spec.ts` | AC-FIN-TCC |
| `era-finance-core/apps/api/test/trade-credit/trade-credit-phase2.spec.ts` | AC-FIN-TCC |
| `era-finance-core/apps/api/test/extra-fields/extra-fields.service.spec.ts` | AC-FIN-EXT |
| `era-finance-core/apps/api/test/saved-list-views/saved-list-views.service.spec.ts` | AC-FIN-VIEW |
| `era-finance-core/apps/api/test/invoices/invoice-print-snapshot.spec.ts` | AC-FIN-PRINT |
