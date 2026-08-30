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
| S-8 | Physio S catalog (CLI-49) | [~] | W4 + Nafta card wave: Solyuks/`belinə`/`NAFTALAN_FILL`/empty-catalog; always rematch `#23`; UAT-SMOKE CLI-49 open |
| S-9 | Nafta card wave — intake + Baku slots (CLI-25/32/34/48) | [~] | `PKG-NAFTA-INTAKE` checklist/print/live instantiate; `#23` `parseBakuDateTime`; now/PLAN `gte now`; ops: seed catalogs → re-Apply `#23` (+ `#31` if USG) |
| S-10 | Catalog seed layers base + Nafta overlay | [~] | ADR clinic-catalog-base-and-org-overlay-seeds; `db:seed:physio` / `db:seed:diagnostic-catalog` = base then org overlay |
| S-11 | Nafta medical SKU dual-run assign (Wave A) | [~] | CLI-50 SCREEN; AC-CLI-SAN-PKG 🟡; `/sanatorium` Select 4 SKUs + `?episode=`; **pilot punch open** |
| S-12 | Nafta PDF quota knots (Wave B) | [~] | CLI-51 API; AC-CLI-SAN-QUOTA 🟡; knots **matrix** UI; UAT open |
| S-13 | Nafta doctor first-day confirm (Wave C) | [~] | CLI-52 SCREEN; AC-CLI-SAN-DAY1 🟡; no Confirm all; AFTER_CHECKUP settings |
| S-14 | Nafta doctor bonus extras (Wave D) | [~] | CLI-53 SCREEN; AC-CLI-BONUS 🟡; bonusEligible; % stay 0 until FO |
| S-15 | Nafta one stay two episodes (Wave E) | [~] | CLI-54 SCREEN; AC-CLI-SAN-PAX 🟡; openEpisode per patient; **pilot punch open** |

Markers: `[ ]` · `[~]` · `[x]` · `[blocked]` · Gate: `gate[x]`
