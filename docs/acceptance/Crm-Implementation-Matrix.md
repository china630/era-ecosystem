# CRM — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Crm-Product-Readiness-Matrix.md`](./Crm-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-CRM-PIPE | Pipeline + lead score + automation | 🟡 | [ ] | DELIVERY-CRM |  |
| AC-CRM-PARTY | Party profile / FIN-MDM / Finance CP | 🟡 | [ ] | M11–M16 |  |
| AC-CRM-WA | WhatsApp Business API stage hook | 🟡 | [ ] | Orch + CRM hook |  |

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs).  
Do not call this table «product readiness».
