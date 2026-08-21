# Logistics — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Logistics-Product-Readiness-Matrix.md`](./Logistics-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

**BE deepen (2026-08-17):** Negative-path suites landed — `__tests__/log-trip-negative.spec.ts`, `log-pod-negative.spec.ts`, `log-ref-negative.spec.ts`, `log-plat-negative.spec.ts`. TENANT stays out of BE rollup.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-LOG-TRIP | Fleet + trip lifecycle + complete event | ✅ | [ ] | `__tests__/log-trip-negative.spec.ts` + DELIVERY-LOGISTICS L1 | Negative: module gate 403; invalid status transition; COMPLETED locked 409; foreign trip complete 404 |
| AC-LOG-POD | POD capture + fuel reports | ✅ | [ ] | `__tests__/log-pod-negative.spec.ts` + L2 POD/fuel | Negative: POD missing recipient; POD/fuel unknown trip 404; non-positive liters |
| AC-LOG-REF | Customs / FX / HS preview via Finance | ✅ | [ ] | `__tests__/log-ref-negative.spec.ts` + LOG-REF-01 | Negative: short HS code; missing FX from; Finance HS/FX failure → explicit 500 (not silent success) |
| AC-LOG-PLAT | Platform add-ons on trip complete | ✅ | [ ] | `__tests__/log-plat-negative.spec.ts` + L4 hooks | Negative: events/dispatch missing/wrong token → 401; notify soft-skip when token unset |
| AC-LOG-TENANT | SHARED pool: `organizationId` on ops rows + composite uniques | 🟡 | [ ] | CP-TENANT-01; kit tenant extension | **Excluded from Scaffold BE rollup.** Schema + filter landed; not Scaffold ✅ (no live SHARED pool / field two-org UAT) |

**Edition / wave rollup (BE, in-scope)** = worst(TRIP, POD, REF, PLAT) → **✅**.  
AC-LOG-TENANT is 🟡 (schema+filter) and stays **out of Scaffold BE rollup** until a live SHARED pool + field isolation UAT.  
Do not call this table «product readiness».

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| AC-LOG-TENANT | Live SHARED pool + field isolation UAT | Out of BE rollup | Schema+filter only |
| Pilot lab / field | UAT signoff / customer | Out of BE plan | Owned by UI/lab plan |

### Negative-path proof index

| Suite | AC |
|-------|----|
| `era-logistics/__tests__/log-trip-negative.spec.ts` | AC-LOG-TRIP |
| `era-logistics/__tests__/log-pod-negative.spec.ts` | AC-LOG-POD |
| `era-logistics/__tests__/log-ref-negative.spec.ts` | AC-LOG-REF |
| `era-logistics/__tests__/log-plat-negative.spec.ts` | AC-LOG-PLAT |
