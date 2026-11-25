# Stub — inpatient MVP waves not yet in code (MED-P0-05 remainder)

Companion to [clinic-inpatient-mvp.md](./clinic-inpatient-mvp.md). Tracks deferred slices so acceptance does not over-claim.

| Wave | Intended capability | Status |
|------|---------------------|--------|
| PR-2 | `ClinicalNote` kinds ADMISSION_EXAM / DAILY_DIARY / DISCHARGE_SUMMARY; discharge blocked without signed epicrisis; `/print/discharge/[admissionId]` | STUB |
| PR-3 UI | MAR grid, `/inpatient/nurse` shift tasks, QR scan reuse, overdue styling, finance SKU consumption on GIVEN | STUB |
| PR-4 UI | Temperature sheet chart, out-of-range highlight on ward board | STUB |
| PR-1 UI | Reception triage list with wait times; server-side patient search (no `pageSize=100` cap) | STUB |
| Reception | REGISTERED pipeline UI (register/refuse before bed) | API only |
| Catalog | MedicationCatalog admin CRUD + Nafta/Finance sync | STUB |

When a row ships, move evidence to COVERAGE_MATRIX **CLI-INP-01** and shrink this table.