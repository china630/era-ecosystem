# Auto Service — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Auto-Product-Readiness-Matrix.md`](./Auto-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-AUTO-WO | Work order CRUD + close event | 🟡 | [ ] | DELIVERY-AUTO A1 |  |
| AC-AUTO-APPT | Appointments + bay calendar contours | 🟡 | [ ] | A2 appointments UI |  |
| AC-AUTO-PLAT | Platform notifications/booking cron + commerce on complete | 🟡 | [ ] | A3 service-due + portal/pay |  |

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs).  
Do not call this table «product readiness».
