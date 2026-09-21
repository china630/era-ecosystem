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
| AC-FIN-HR | HR payroll depth + MDM person read-through | ✅ | [ ] | `__tests__/fin-hr-negative.spec.ts`; `emas-wave7.spec.ts` | Negative: USER denied payroll finance (OWNER/ACCOUNTANT only). UI depth still 🟡 in Readiness. **Step 5:** Employee name SoR = MDM parts. **Evrostar wave 7:** `emasMode` + PENDING_MANUAL queue (`FIN-EMAS-01` = STUB) — [evrostar-wave-7.md](../runbooks/evrostar-wave-7.md). **P1:** TRANSFER enqueue + Excel→queue markSubmitted + terminate CTA→CP — Demo/Pilot unchanged |
| AC-FIN-TAX | Tax / Goskomstat statforms | ✅ | [ ] | `__tests__/fin-tax-negative.spec.ts` | Negative: invalid VÖEN length on taxpayer lookup |
| AC-FIN-FA | Fixed + intangible assets | ✅ | [ ] | `__tests__/fin-fa-negative.spec.ts` | Negative: dispose refuses already DISPOSED asset; **DONATION** acquire without note ≥10 |
| AC-FIN-EVT | Satellite event ingress → accounting dispatch | ✅ | [ ] | `__tests__/fin-evt-negative.spec.ts` | Negative: InternalServiceTokenGuard 401 without/wrong Bearer; fail-closed in production |
| AC-FIN-CFG | Desired-state SSO / service tokens from orchestrator (no compose folklore) | ✅ | [ ] | `__tests__/fin-cfg-negative.spec.ts` | Negative: runtime-config without Bearer → 401; short `ssoSharedSecret` rejected by DTO |
| AC-FIN-GAAP | Multi-GAAP NAS→IFRS + AccountingBook Waves A–C engineering slice + Wave D ops freeze/delta eng | 🟡 | [ ] | integrity + per-book + CF specs; multi-target mirror and Audit Hub specs; `accounting-book.spec.ts`; `compare-books.spec.ts`; `wave5-ops-mgmt.spec.ts`; `wave5-mgmt-delta.spec.ts`; UAT-SMOKE FIN-GAAP/FIN-BOOK | PARTIAL until UAT. Wave **D** eng in Wave 5 (ops freeze + MgmtLaborDelta) — COVERAGE FIN-BOOK-MGMT-01 = API not SHIPPED. Multi-target PUBLISHED-set fan-out, per-book idempotency/outcomes, and default-ops vs ACTIVE non-ops Audit Hub presence/debit parity are covered; remaining report/close edges and Lab RT remain. [ADR AccountingBook](../adr/finance-accounting-book.md) + [evrostar-wave-5.md](../runbooks/evrostar-wave-5.md). |
| AC-FIN-TCC | Trade credit lock + policy + Phase 2–3 eng | 🟡 | [ ] | `trade-credit.service.spec.ts`; classifier/limit/policy/leak/phase2 specs; wholesale `ws-credit-negative.spec.ts`; orch `buyer-portal-negative.spec.ts` | Phase 0–3 eng (incl. WC suggested limit). Negatives: SKU 402; no policyGroup/suggestedLimit/proposedKind buyer/wholesale; pin D; enrich optional D; factor SKU gate; WC never auto-apply. COVERAGE FIN-TCC-01..05 API. **Not** Scaffold ✅ until Lab RT. ADR finance-trade-credit-control + finance-trade-credit-factor-lead |
| AC-FIN-EXT | Invoice extra fields (SaaS core, not СКД) | 🟡 | [ ] | `test/extra-fields/extra-fields.service.spec.ts`; kit `extra-attributes.test.ts` | W1: registry + JSONB on Invoice; unknown key 400; not GL. **Out of W6 BE rollup.** ADR extensibility-forms-print-reports |
| AC-FIN-VIEW | Invoice register saved views (SaaS core, not СКД) | 🟡 | [ ] | `test/saved-list-views/saved-list-views.service.spec.ts`; kit `saved-list-view.test.ts` | W2: whitelist columns/filters/sort; no JSONB extra filters; not SQL. ADR extensibility-forms-print-reports |
| AC-FIN-PRINT | Commercial invoice print snapshot (SaaS core, not fiscal) | 🟡 | [ ] | `test/invoices/invoice-print-snapshot.spec.ts`; kit `print-snapshot.test.ts` | W3: flat placeholders + one lines loop; vendor HTML; not KO-1/e-qaimə. ADR extensibility-forms-print-reports |
| AC-FIN-RBAC | Finance consumes CP JWT grants (`api:*` / `admin:*` / `screen:*`) | 🟡 | [ ] | UAT-SMOKE § FIN-RBAC-01; ADR finance-domain-permissions-and-rbac; `rbac-bridge-sprint.spec.ts` (auditor belt) | **Out of BE rollup.** Door = `PermissionsGuard` keys (Post/Approve = `api:ledger.post`). No Finance matrix UI. SCREEN until field UAT — not SHOW/GA. Do **not** flip AC-FIN-GL. |

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs) → **✅**.  
**AC-FIN-RBAC is out of Scaffold BE rollup** (matrix SCREEN / field UAT open) — does not darken BE ✅ / does not flip AC-FIN-GL.  
Do not call this table «product readiness».

**SaaS Wave 3 (audit only):** Finance already request-tenants via Nest `TenantContextInterceptor` + membership ALS from JWT. Wave 3 did **not** port kit `enterSatelliteTenant`. No silent process-bind stamps via kit in production paths.
### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| Pilot lab / field | UAT signoff / customer | Out of BE plan | Owned by UI/lab plan |
| UI / Demo depth | Payroll / FA surfaces | Out of BE plan | Product-Readiness UI 🟡 · Demo ❌ |
| AC-FIN-RBAC | Field UAT deny paths + SHOW claim | Code | Out of BE rollup (🟡 SCREEN) |

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
