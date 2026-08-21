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
| AC-DBO-OPEN | Open API B2B + API keys | 🟡 | [ ] | engine /dbo/open/* + `/open-api` UI + `dbo-open-negative.spec.ts` | **In BE rollup.** UI class SCREEN (not curl-only). Scaffold still 🟡 until playbook close. [BE-OPEN-AND-TOPO-RETURN.md](./BE-OPEN-AND-TOPO-RETURN.md) |
| AC-DBO-SO | Standing orders / DD list+create+pause | ✅ | [ ] | dbo/standing-orders; CIF scope; unauth 401 | Corp large SO paused pending dual-control |
| AC-DBO-LOAN-APP | Loan application draft→submit | ✅ | [ ] | dbo/loans/applications; no book | Book stays ops SoD |
| AC-DBO-3DS | Card 3DS challenge complete | ✅ | [ ] | dbo/cards/3ds/challenges; card ownership | Ops creates challenge |
| AC-BANK-TENANT | DBO channel `organizationId` + kit tenant filter | 🟡 | [ ] | CP-TENANT-01; era-bank-dbo migration + mergeWhere | **Out of BE rollup.** Same remaining TENANT work as hotel (live pool + field UAT), not a bank-only ban. Bind + runtime-config HTTP landed (CP-BIND-01 / CP-CFG-01) |

**Edition / wave rollup (BE only)** = worst(AUTH, ACC, PAY, CORP, OPEN, SO, LOAN-APP, 3DS) → **🟡** (OPEN).  
AC-DBO-OPEN is **in Scaffold BE rollup** (owner 2026-08-18). Code residual, not Hotel INT. TENANT stays **out**.  
Do not call this table «product readiness». Do **not** mark OPEN Scaffold ✅ until the return playbook checklist.

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| AC-DBO-OPEN | Open API B2B + API keys (UI SCREEN; Scaffold not ✅) | Code | **In BE rollup** — see [BE-OPEN-AND-TOPO-RETURN.md](./BE-OPEN-AND-TOPO-RETURN.md) |
| AC-BANK-TENANT | Live SHARED bank pool | Out of BE rollup | Not built (same as hotel TENANT); schema+filter only |
| (other channel ACs) | — | — | Scaffold ✅ — no Code residual listed |

### Negative-path proof index

| Suite | AC |
|-------|----|
| live Open API UAT (pending — keeps OPEN 🟡) | AC-DBO-OPEN |
| UAT-SMOKE / DELIVERY negative paths (existing) | AC-DBO-AUTH / PAY / CORP / SO / LOAN-APP / 3DS |
