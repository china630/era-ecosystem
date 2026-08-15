# Bank DBO — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Bank-DBO-Product-Readiness-Matrix.md`](./Bank-DBO-Product-Readiness-Matrix.md)  
**Parent scope boundary:** [`Bank-Capability-Inventory.md`](./Bank-Capability-Inventory.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-DBO-AUTH | Retail/corporate auth (OTP + ASAN/SİMA stub) | ✅ | [ ] | DELIVERY-BANK-DBO; UAT-SMOKE; login stub badge | mode=stub ASAN — field Scaffold ⏸ until YC-E3 |
| AC-DBO-ACC | Accounts + dashboard balances via engine BFF | ✅ | [ ] | BFF → /api/v1/dbo/* | No local ledger |
| AC-DBO-PAY | Transfers + payment orders + AML preflight | ✅ | [ ] | DELIVERY payments + preflight; insufficient-funds / reject paths in UAT | Live rails E1 |
| AC-DBO-CORP | Corporate multi-signatory approve queue | ✅ | [ ] | PaymentSignRequest channel DB; dual-sign reject UAT step |  |
| AC-DBO-OPEN | Open API B2B + API keys | 🟡 | [ ] | engine /dbo/open/* | Curl-only stretch |
| AC-DBO-SO | Standing orders / DD list+create+pause | ✅ | [ ] | dbo/standing-orders; CIF scope; unauth 401 | Corp large SO paused pending dual-control |
| AC-DBO-LOAN-APP | Loan application draft→submit | ✅ | [ ] | dbo/loans/applications; no book | Book stays ops SoD |
| AC-DBO-3DS | Card 3DS challenge complete | ✅ | [ ] | dbo/cards/3ds/challenges; card ownership | Ops creates challenge |

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs).  
Do not call this table «product readiness».
