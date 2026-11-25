# ADR: Clinic inpatient MVP foundation (MED-P0-05)

## Status

Accepted — 2026-11-25 (foundation: PR-1 + PR-3 minimal + PR-4 vitals scaffold)

Related: [02-remediation-backlog.md](./02-remediation-backlog.md) (MED-P0-05) · [clinic-icd10-catalog.md](./clinic-icd10-catalog.md) · CLI-15 / CLI-INP-01 in `docs/COVERAGE_MATRIX.md`

## Context

Ward-lite (CLI-15) covered bed census and ADT-light admit/transfer/discharge only. Commercial inpatient (reception, attending physician, movement ledger, vitals, MAR) requires persistent models and APIs under preset `inpatient_day` + module `clinic_inpatient`.

## Decision

1. **Admission** — `InpatientAdmission` gains `admissionKind`, `source`, optional `departmentId` (`ServiceDepartment`), `attendingPractitionerId`, `caseNumber`, `refusalReason`, `outcome`. Status lifecycle: `REGISTERED | ADMITTED | DISCHARGED | REFUSED` (legacy `TRANSFERRED` maps to `ADMITTED` on migrate). Bed transfers are `InpatientMovement` rows, not admission status.
2. **Beds** — `Bed.status` is enum `AVAILABLE | OCCUPIED | CLEANING | BLOCKED`. Discharge sets prior bed `CLEANING` (housekeeping before reuse).
3. **Vitals / risk** — `VitalSign` + `RiskAssessment` on admission (and optional visit/episode FK for outpatient reuse). APIs: `GET/POST /api/inpatient/:id/vitals`, `GET/POST /api/inpatient/:id/risk-assessments`.
4. **Orders / MAR (minimal)** — `MedicationCatalog`, `InpatientOrder`, `OrderAdministration`; cron `POST /api/cron/inpatient-mar-generate` materializes DUE rows 48h ahead from `frequency` (`HH:mm,…` or `q8h`).
5. **Nest** — Native controllers only (`inpatient.controller`, `vitals.controller`, `inpatient_orders.controller`, `cron_inpatient-mar-generate.controller`) registered in `clinic-native.module.ts`.
6. **UI (foundation)** — `/inpatient` assign modal sends `admissionKind` + `source`. Nurse MAR grid, temperature chart, and reception triage board remain follow-up waves.

## Out of scope (this ADR)

See [clinic-inpatient-deferred-waves.md](./clinic-inpatient-deferred-waves.md).

## Consequences

- CLI-INP-01 is **SCREEN**: API foundation + partial UI; not Pilot-ready HIS.
- PR-2 discharge summary gate and print epicrisis are not enforced yet.
- `MedicationCatalog` seed / P1-04 retail integration deferred.