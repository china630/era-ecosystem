# F&B — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Fnb-Product-Readiness-Matrix.md`](./Fnb-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

**BE deepen (2026-08-17):** Negative-path suites landed — `__tests__/fnb-pos-negative.spec.ts`, `fnb-inv-negative.spec.ts`, `fnb-labor-negative.spec.ts`.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-FNB-POS | POS floor + courses / KDS | ✅ | [ ] | `__tests__/fnb-pos-negative.spec.ts` | Negative: module gate 403; CLOSED ticket; hotel-folio pay block |
| AC-FNB-INV | Recipe depletion / stock events | ✅ | [ ] | `__tests__/fnb-inv-negative.spec.ts` | Negative: stock off unless enabled; VOID lines excluded |
| AC-FNB-LABOR | Labor roster / PIN clock | ✅ | [ ] | `__tests__/fnb-labor-negative.spec.ts` | Negative: module gate; invalid PIN hash |

**Topology note (out of BE rollup):** F&B tenant roots carry `organizationId` + kit filter (CP-TENANT-01 API). SHARED F&B pool not an AC this edition — see Fnb-Acceptance-System.

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs) → **✅**.  
Do not call this table «product readiness».

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| Pilot lab / field | UAT signoff / customer | Out of BE plan | Owned by UI/lab plan |
| (no TENANT AC) | SHARED F&B pool | Out of BE rollup | Topology note only — not an AC this edition |

### Negative-path proof index

| Suite | AC |
|-------|----|
| `era-fnb-pos/__tests__/fnb-pos-negative.spec.ts` | AC-FNB-POS |
| `era-fnb-pos/__tests__/fnb-inv-negative.spec.ts` | AC-FNB-INV |
| `era-fnb-pos/__tests__/fnb-labor-negative.spec.ts` | AC-FNB-LABOR |
