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
| AC-FIN-HR | HR payroll depth + MDM person read-through | ✅ | [ ] | `__tests__/fin-hr-negative.spec.ts` | Negative: USER denied payroll finance (OWNER/ACCOUNTANT only). UI depth still 🟡 in Readiness. **Step 5:** Employee name SoR = MDM parts (`firstName`/`middleName`/`lastName`); no `Employee.patronymic` / `splitAzPersonName`; `birthDate` field map; opening-balance `middleName` alias |
| AC-FIN-TAX | Tax / Goskomstat statforms | ✅ | [ ] | `__tests__/fin-tax-negative.spec.ts` | Negative: invalid VÖEN length on taxpayer lookup |
| AC-FIN-FA | Fixed + intangible assets | ✅ | [ ] | `__tests__/fin-fa-negative.spec.ts` | Negative: dispose refuses already DISPOSED asset; **DONATION** acquire without note ≥10 |
| AC-FIN-EVT | Satellite event ingress → accounting dispatch | ✅ | [ ] | `__tests__/fin-evt-negative.spec.ts` | Negative: InternalServiceTokenGuard 401 without/wrong Bearer; fail-closed in production |
| AC-FIN-CFG | Desired-state SSO / service tokens from orchestrator (no compose folklore) | ✅ | [ ] | `__tests__/fin-cfg-negative.spec.ts` | Negative: runtime-config without Bearer → 401; short `ssoSharedSecret` rejected by DTO |

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs) → **✅**.  
Do not call this table «product readiness».

**SaaS Wave 3 (audit only):** Finance already request-tenants via Nest `TenantContextInterceptor` + membership ALS from JWT. Wave 3 did **not** port kit `enterSatelliteTenant`. No silent process-bind stamps via kit in production paths.
### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| Pilot lab / field | UAT signoff / customer | Out of BE plan | Owned by UI/lab plan |
| UI / Demo depth | Payroll / FA surfaces | Out of BE plan | Product-Readiness UI 🟡 · Demo ❌ |

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
