# Data Hub — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Data-Hub-Product-Readiness-Matrix.md`](./Data-Hub-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

**BE deepen (2026-08-17):** Green Scaffold BE wave 4 — `apps/api/__tests__/dh-*-negative.spec.ts` (REG/FX/BANK/HS).  
**Wave 8 (2026-08-18):** AC-DH-VOEN excluded from Scaffold BE rollup (Hotel INT pattern); stays Scaffold 🟡 / External ⏸ (e-taxes BLOCKED).

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-DH-REG | Registry health + auth (API key / service token) | ✅ | [ ] | `__tests__/dh-reg-negative.spec.ts` | Negative: 401 without key; INVALID_API_KEY |
| AC-DH-FX | FX rates ingest + convert APIs | ✅ | [ ] | `__tests__/dh-fx-negative.spec.ts` | Negative: RATE_NOT_FOUND; INVALID_AMOUNT |
| AC-DH-BANK | Banks + IBAN validate | ✅ | [ ] | `__tests__/dh-bank-negative.spec.ts` | Negative: empty / format / MOD-97 IBAN |
| AC-DH-VOEN | VÖEN company lookup + PII masking | 🟡 | [ ] | Wave 3; IND-VOEN live e-taxes BLOCKED | External ⏸ — e-taxes BLOCKED; **excluded from Scaffold BE rollup** (Hotel INT) |
| AC-DH-HS | HS / tariff + static catalogs | ✅ | [ ] | `__tests__/dh-hs-negative.spec.ts` | Negative: HS_NOT_FOUND; TARIFF_NOT_FOUND |

**Edition / wave rollup (BE only)** = worst(REG, FX, BANK, HS) → **✅**.  
AC-DH-VOEN remains 🟡 and is **out of Scaffold BE rollup** until live e-taxes clears BLOCKED. Do **not** mark VOEN Scaffold ✅.  
Do not call this table «product readiness».

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| AC-DH-VOEN | Live e-taxes VÖEN lookup | External ⏸ | BLOCKED (e-taxes); **Excluded from Scaffold BE rollup** (Wave 8; Hotel INT) |

### Negative-path proof index

| Suite | AC |
|-------|----|
| `era-data-hub/apps/api/__tests__/dh-reg-negative.spec.ts` | AC-DH-REG |
| `era-data-hub/apps/api/__tests__/dh-fx-negative.spec.ts` | AC-DH-FX |
| `era-data-hub/apps/api/__tests__/dh-bank-negative.spec.ts` | AC-DH-BANK |
| `era-data-hub/apps/api/__tests__/dh-hs-negative.spec.ts` | AC-DH-HS |
