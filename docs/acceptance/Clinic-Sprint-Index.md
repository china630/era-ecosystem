# Clinic — Sprint / Wave Index

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness:** [`Clinic-Product-Readiness-Matrix.md`](./Clinic-Product-Readiness-Matrix.md)  
**AC Matrix:** [`Clinic-Implementation-Matrix.md`](./Clinic-Implementation-Matrix.md)

Header honesty = **Product Readiness** rollup (not «all ✅»).  
Current rollup: Gate ✅ (scaffold only) · BE ✅ · UI 🟡 · Sell: do not claim GA — fiscal/HL7 STUB; pilot open

---

## Wave board

| Wave | Gate | AC rollup (from Matrix) | Pilot-ready | Notes / log |
|------|------|-------------------------|-------------|-------------|
| W0 baseline | gate[x] | ✅ | [ ] | reports/clinic-stage-W0-signoff.md scaffold-gate-pass; Green-BE wave 5 negatives |
| W1 honesty | gate[ ] | ✅ | [ ] | Close P0 residuals; UAT lab signoff |

## Backlog

| ID | Item | Status | Proof |
|----|------|--------|-------|
| S-1 | Stage-gate script green + signoff | [~] | `scripts/run-clinic-stage-gate.mjs` |
| S-2 | Pilot lab UAT-SMOKE signed | [ ] | `era-clinic/doc/UAT-SMOKE.md` |
| S-3 | Field / customer sign-off | [ ] | — |
| S-4 | SHARED clinic pool (`organizationId` + isolation) | [~] | AC-CLI-TENANT 🟡 — schema+filter on Nafta; live pool / field UAT open |
| S-5 | BE deepen → Scaffold ✅ (excl. TENANT) | [x] | IM + `__tests__/cli-*-negative.spec.ts` |
| S-6 | ICD-10 waves CLI-39…42 | [~] | ADR clinic-icd10-catalog; UAT-SMOKE ICD; `__tests__/icd10-catalog.spec.ts` |
| S-7 | Procedure TTK → Finance stock (CLI-47) | [~] | ADR clinic-procedure-consumable-ttk; W1 BOM+event API; Finance write-off W2 |

Markers: `[ ]` · `[~]` · `[x]` · `[blocked]` · Gate: `gate[x]`
