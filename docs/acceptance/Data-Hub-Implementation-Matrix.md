# Data Hub — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Data-Hub-Product-Readiness-Matrix.md`](./Data-Hub-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-DH-REG | Registry health + auth (API key / service token) | 🟡 | [ ] | DH-REGISTRY; DELIVERY Wave 0 | HEADLESS |
| AC-DH-FX | FX rates ingest + convert APIs | 🟡 | [ ] | DH-FX-01; Wave 1 |  |
| AC-DH-BANK | Banks + IBAN validate | 🟡 | [ ] | Wave 2 |  |
| AC-DH-VOEN | VÖEN company lookup + PII masking | 🟡 | [ ] | Wave 3; IND-VOEN live e-taxes BLOCKED | External live path blocked |
| AC-DH-HS | HS / tariff + static catalogs | 🟡 | [ ] | Waves 4–5 |  |

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs).  
Do not call this table «product readiness».
