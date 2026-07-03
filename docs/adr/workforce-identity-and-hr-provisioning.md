# ADR: Workforce Identity and HR Provisioning

**Status:** Accepted (amended v3 Plan E)  
**Date:** 2026-06-05  
**Master rollup:** [cp-core-workforce-hub.md](./cp-core-workforce-hub.md) — supersedes W3 `finance_hr` / `local_master` hire modes.

## Context

ERA needs a consistent person identity across finance HR, satellite operational staff, and cross-org owner visibility—without duplicating PII in the orchestrator.

## Decision

### Master of record

| Layer | Role |
|-------|------|
| **MDM** (`era_mdm`) | Canonical natural person (`GlobalNaturalPerson` + `PersonIdentifier`); supports FIN, passport, merge-to-FIN |
| **Finance Employee** | Employment master when HR module is purchased; holds `globalPersonId`, tax residency, ƏMAS eligibility |
| **Satellite User / StaffRoster** | Operational access (local login, PIN, role); stamped with `globalPersonId` |
| **Orchestrator WorkforceAssignment** | Cross-org registry **without PII** — only `globalPersonId` + org + satellite references |
| **Orchestrator WorkforceAbsence** (v3 Plan A) | **Absence workflow master** — submit/approve/reject/cancel; Finance holds payroll mirror via `WORKFORCE_ABSENCE_*` events |
| **Orchestrator WorkforceEmployment** (v3 Plan C) | **Hire + provisioning master** — `cpEmploymentId`, role templates, `STAFF_*` publisher |
| **Orchestrator SatelliteRoleTemplate / RoleBinding** (v3 Plan C) | Position × satellite → default role; manual grants; Security Admin |

### Two-contour login

1. **Operational staff** (waiter, reception, housekeeping): `POST /api/auth/login` on the satellite; no org picker.
2. **Owner / management**: SSO from orchestrator with signed `organizationId`.

### HR provisioning bus (CP → satellite)

Events on the shared satellite envelope (`@era/contracts`):

- `STAFF_PROVISIONED` — create/update local `User` / `StaffRoster` / `Practitioner`; payload **`cpEmploymentId` required** (v2); `financeEmployeeId` optional payroll extension
- `STAFF_DEACTIVATED` — deactivate satellite access keyed on `cpEmploymentId`
- `STAFF_CLOCK_BATCH` (satellite → finance) — ingest `PinClockEvent` into finance `TimesheetEntry`

**Publisher (Plan C):** orchestrator `WorkforceProvisionService` on CP hire, manual grant, terminate. Finance `HrStaffProvisioningService` **deprecated** (no-op).

Orchestrator fans out to registered `SatelliteEndpoint` and updates `WorkforceAssignment` keyed by `[organizationId, satelliteKey, cpEmploymentId]`.

### Clinic practitioner hire (CP workforce only)

When org has **`platform_workforce`** (`hireMode=cp_workforce` from `GET /platform/v1/workforce/policy`):

1. Hire only via CP **`POST /platform/v1/workforce/employments/hire`** (MDM person + org unit + position + satellite checkboxes).
2. Role resolved from `SatelliteRoleTemplate` → `WorkforceRoleBinding` → `STAFF_PROVISIONED`.
3. SatAdmin `/admin/master-data` — **ops catalog only** (specialty, slot minutes); **POST practitioners → 403**.

Optional payroll mirror: `WORKFORCE_EMPLOYMENT_HIRED` → Finance creates `Employee` with `cpEmploymentId` when `hr_full` entitled.

Legacy `finance_hr` / `local_master` hire modes removed (clean v3 cut).

### Foreign employees

- Finance may create employees with passport + `taxResidencyStatus=NON_RESIDENT` without FIN (`emasEligible=false`).
- `POST /hr/employees/:id/convert-to-fin` resolves FIN in MDM and calls `persons/merge` when a foreigner record must fold into a citizen record.
- ƏMAS extension prefill returns `emasStatus: PENDING_FIN` until FIN is present.

### Identity resolution in satellites

- `resolvePersonIdentity` / `linkPersonIdentity` in `@era/satellite-kit` → MDM internal API.
- Clinic `PatientRef`: MDM-only identity storage (Wave 1).
- Hotel `Guest`: MDM identity link + operational cache — [hotel-guest-pii-ops-cache.md](./hotel-guest-pii-ops-cache.md).

## Implementation references

- MDM: `era-orchestrator/apps/api/src/mdm/`
- Finance HR: `era-finance-core/apps/api/src/hr/employees.service.ts`
- Events: `packages/era-contracts/src/events/hr.events.ts`
- Workforce registry + policy: `era-orchestrator/apps/api/src/workforce/`, `platform/workforce/` (Wave 3)
- F&B provision handler: `era-fnb-pos/app/api/integration/staff-provision/route.ts`
- Clinic provision handler: `era-clinic/src/lib/staff-provision.ts`

## Consequences

- Satellites without Finance use **CP workforce hire** with MDM discipline; no local_master practitioner create when `cp_workforce` active.
- Orchestrator never stores employee names or FIN—only `globalPersonId` references.
- Crypto keys (`PII_ENCRYPTION_KEY`, `PII_BLIND_INDEX_KEY`) must match between orchestrator MDM and finance for cross-system resolution.
