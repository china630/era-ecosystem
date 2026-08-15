# Logistics — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Logistics-Product-Readiness-Matrix.md`](./Logistics-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-LOG-TRIP | Fleet + trip lifecycle + complete event | 🟡 | [ ] | DELIVERY-LOGISTICS L1; SATELLITE_LOGISTICS_TRIP_COMPLETED |  |
| AC-LOG-POD | POD capture + fuel reports | 🟡 | [ ] | L2 POD/fuel |  |
| AC-LOG-REF | Customs / FX / HS preview via Finance | 🟡 | [ ] | LOG-REF-01 COVERAGE |  |
| AC-LOG-PLAT | Platform add-ons on trip complete | 🟡 | [ ] | L4 notifications/portal/delivery/booking |  |

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs).  
Do not call this table «product readiness».
