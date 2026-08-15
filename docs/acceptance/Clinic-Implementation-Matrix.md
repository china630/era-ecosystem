# Clinic — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Clinic-Product-Readiness-Matrix.md`](./Clinic-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-CLI-MD | Master data (practitioners, rooms, resources, procedure types) | 🟡 | [ ] | COVERAGE CLI-01..04,30,36 | Negative path / UAT lab signoff open |
| AC-CLI-OPS | Appointments + day-ops + reception queue | 🟡 | [ ] | CLI-05,14,26,29 | SHIPPED facts; Scaffold 🟡 until gate signoff |
| AC-CLI-PT | Patients / clinical card / demographics | 🟡 | [ ] | CLI-06,25,28 |  |
| AC-CLI-LAB | Lab orders + diagnostic catalog | 🟡 | [ ] | CLI-11,12,32 | HL7 prod = STUB CLI-23 |
| AC-CLI-SAN | Sanatorium chart + doctor-confirm FIFO | 🟡 | [ ] | CLI-13,31 |  |
| AC-CLI-CASH | Cashier ops + settle | 🟡 | [ ] | CLI-33; fiscal CLI-24 STUB | mode=stub fiscal — not Scaffold ✅ field |
| AC-CLI-PRINT | Print forms + branding | 🟡 | [ ] | CLI-34 |  |
| AC-CLI-CAP | Clinic→hotel capacity foresight | 🟡 | [ ] | CLI-27 |  |

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs).  
Do not call this table «product readiness».
