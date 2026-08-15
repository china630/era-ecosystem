# Platform — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Platform-Product-Readiness-Matrix.md`](./Platform-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-CP-AUTH | Auth / SSO / hybrid RBAC | 🟡 | [ ] | INTEGRATION_SSO_EVENTS; UAT RBAC |  |
| AC-CP-BILL | Billing / entitlements / subscription | 🟡 | [ ] | CP-BILLING; pricing_modules host |  |
| AC-CP-MDM | MDM natural person identity | 🟡 | [ ] | ORCH-MDM-*; internal/v1/mdm |  |
| AC-CP-WF | Workforce hub (hire, absence, seats, security) | 🟡 | [ ] | CP-WF-HUB/EXP/IMP/SEAT |  |
| AC-CP-SA | Super-admin platform ops | 🟡 | [ ] | UAT-SMOKE-PLATFORM |  |
| AC-CP-INT | Integration audit boundaries (MDM/hub/events) | 🟡 | [ ] | npm run audit:integration:strict | Gate G1 primary |

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs).  
Do not call this table «product readiness».
