# Retail — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Retail-Product-Readiness-Matrix.md`](./Retail-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-RET-POS | POS + promos + customer | 🟡 | [ ] | DELIVERY-RETAIL |  |
| AC-RET-STOCK | Mobile stock / replenishment / SRM | 🟡 | [ ] | M14–M16 |  |
| AC-RET-FISCAL | Offline queue / fiscal KKM / marketplace | 🟡 | [ ] | M8–M10 stubs where applicable | mode=stub — not ga |

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs).  
Do not call this table «product readiness».
