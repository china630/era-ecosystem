# Wholesale — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Wholesale-Product-Readiness-Matrix.md`](./Wholesale-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-WS-ORD | B2B order + confirm shipment event | 🟡 | [ ] | DELIVERY-WHOLESALE MVP |  |
| AC-WS-PICK | Pick lists + line confirm | 🟡 | [ ] | pick-lists API/UI |  |
| AC-WS-CREDIT | Credit limit via Finance (live or stub) | 🟡 | [ ] | GET /api/credit-limit | stub fallback when FINANCE_API_URL unset |
| AC-WS-PLAT | Platform add-ons on order confirm | 🟡 | [ ] | portal/pay/delivery/loyalty hooks |  |

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs).  
Do not call this table «product readiness».
