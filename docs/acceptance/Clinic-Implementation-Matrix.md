# Clinic — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Clinic-Product-Readiness-Matrix.md`](./Clinic-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

**BE deepen (2026-08-17):** Green Scaffold BE wave 5 — negative-path suites `__tests__/cli-*-negative.spec.ts`.  
**Scope-cut:** AC-CLI-LAB = lab orders ops (not live HL7). AC-CLI-CASH = cashier settle/ops (not live KKM). HL7 CLI-23 + fiscal CLI-24 = External residual (like Hotel HOT-02).

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-CLI-MD | Master data (practitioners, rooms, resources, procedure types) | ✅ | [ ] | `__tests__/cli-md-negative.spec.ts` + CLI-01..04,30,36,38 | Negative: module gate; inactive practitioner / catalog |
| AC-CLI-OPS | Appointments + day-ops + reception queue | ✅ | [ ] | `__tests__/cli-ops-negative.spec.ts` + CLI-05,14,26,29 | Negative: module gate 403; cancel COMPLETED; reschedule deny |
| AC-CLI-PT | Patients / clinical card / demographics | ✅ | [ ] | `__tests__/cli-pt-negative.spec.ts` + CLI-06,25,28,40 | Negative: module gate; MDM identifier / anamnesis deny; visit diagnoses CLI-40 (`__tests__/icd10-catalog.spec.ts`); card ICD write without open episode |
| AC-CLI-LAB | Lab orders ops + diagnostic catalog | ✅ | [ ] | `__tests__/cli-lab-negative.spec.ts` + CLI-11,12,32 | **Ops only** — illegal publish / collect / complete; not live HL7 |
| AC-CLI-SAN | Sanatorium chart + doctor-confirm FIFO | ✅ | [ ] | `__tests__/cli-san-negative.spec.ts` + CLI-13,31,38,39 | Negative: FIFO skip → 409; module gate; ICD empty/chapter reject (`__tests__/icd10-catalog.spec.ts`) |
| AC-CLI-CASH | Cashier settle / ops | ✅ | [ ] | `__tests__/cli-cash-negative.spec.ts` + CLI-33 | **Settle/ops only** — visit/shift deny; live fiscal = External |
| AC-CLI-PRINT | Print forms + branding | ✅ | [ ] | `__tests__/cli-print-negative.spec.ts` + CLI-34 | Negative: missing source; unsupported lang |
| AC-CLI-CAP | Clinic→hotel capacity foresight | ✅ | [ ] | `__tests__/cli-cap-negative.spec.ts` + CLI-27 | Negative: critical risk blocks booking |
| AC-CLI-TENANT | SHARED pool: `organizationId` on ops rows + composite uniques | 🟡 | [ ] | CP-TENANT-01; kit fail-closed tenant extension; UAT-SMOKE two-org outline | **Excluded from Scaffold BE rollup.** Schema + filter landed (no `unbound` default); UAT outline + pending signoff (`reports/two-org-isolation-signoff.md`) — still not Scaffold ✅ (no field pass / live SHARED pool) |

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs except AC-CLI-TENANT) → **✅**.  
AC-CLI-TENANT is 🟡 (schema+filter) and stays **out of Scaffold BE rollup** until a live SHARED pool + field isolation UAT.  
Do not call this table «product readiness».

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| AC-CLI-LAB / CLI-23 | HL7 production adapter | External ⏸ | Scope-cut (like Hotel HOT-02) — not AC-CLI-LAB ops |
| AC-CLI-CASH / CLI-24 | Live fiscal KKM | External ⏸ | Scope-cut — not AC-CLI-CASH settle/ops |
| Pilot lab / field | UAT signoff / customer | Out of BE plan | Owned by UI/lab plan |
| AC-CLI-TENANT | Live SHARED pool + field isolation UAT | Out of BE rollup | Schema+filter only |
| CLI-47 | Procedure TTK → Finance inventory | Out of BE plan | ADR `clinic-procedure-consumable-ttk`; API W1 (BOM+event); Finance write-off W2 |
| CLI-48 | Gender session windows | Out of BE plan | ADR; **API** — not Scaffold, not in AC-CLI-SAN rollup |
| CLI-49 | Matrix replan | Out of BE plan | ADR; **API** — not Scaffold, not in AC-CLI-OPS rollup |

### Negative-path proof index

| Suite | AC |
|-------|----|
| `era-clinic/__tests__/cli-ops-negative.spec.ts` | AC-CLI-OPS |
| `era-clinic/__tests__/cli-pt-negative.spec.ts` | AC-CLI-PT |
| `era-clinic/__tests__/cli-md-negative.spec.ts` | AC-CLI-MD |
| `era-clinic/__tests__/cli-san-negative.spec.ts` | AC-CLI-SAN |
| `era-clinic/__tests__/icd10-catalog.spec.ts` | AC-CLI-SAN (CLI-39) + AC-CLI-PT (CLI-40) selectable ICD |
| `era-clinic/__tests__/cli-lab-negative.spec.ts` | AC-CLI-LAB |
| `era-clinic/__tests__/cli-print-negative.spec.ts` | AC-CLI-PRINT |
| `era-clinic/__tests__/cli-cap-negative.spec.ts` | AC-CLI-CAP |
| `era-clinic/__tests__/cli-cash-negative.spec.ts` | AC-CLI-CASH |
