# ADR: Workforce Identity and HR Provisioning

**Status:** Accepted  
**Date:** 2026-06-05

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

### Two-contour login

1. **Operational staff** (waiter, reception, housekeeping): `POST /api/auth/login` on the satellite; no org picker.
2. **Owner / management**: SSO from orchestrator with signed `organizationId`.

### HR provisioning bus (finance → satellite)

Events on the shared satellite envelope (`@era/contracts`):

- `STAFF_PROVISIONED` — create/update local `User` / `StaffRoster`, map finance position → satellite role
- `STAFF_DEACTIVATED` — deactivate satellite access
- `STAFF_CLOCK_BATCH` (satellite → finance) — ingest `PinClockEvent` into finance `TimesheetEntry`

Finance emits provisioning when `Employee.provisionedSatelliteKey` is set. Orchestrator fans out to the registered `SatelliteEndpoint` and updates `WorkforceAssignment`.

### Foreign employees

- Finance may create employees with passport + `taxResidencyStatus=NON_RESIDENT` without FIN (`emasEligible=false`).
- `POST /hr/employees/:id/convert-to-fin` resolves FIN in MDM and calls `persons/merge` when a foreigner record must fold into a citizen record.
- ƏMAS extension prefill returns `emasStatus: PENDING_FIN` until FIN is present.

### Identity resolution in satellites

- `resolvePersonIdentity` in `@era/satellite-kit` calls `POST /internal/v1/mdm/persons/resolve`.
- Clinic `PatientRef` and hotel `Guest` persist passport/nationality and backfill `globalPersonId`.

## Implementation references

- MDM: `era-orchestrator/apps/api/src/mdm/`
- Finance HR: `era-finance-core/apps/api/src/hr/employees.service.ts`
- Events: `packages/era-contracts/src/events/hr.events.ts`
- Workforce registry: `era-orchestrator/apps/api/src/workforce/`
- F&B provision handler: `era-fnb-pos/app/api/integration/staff-provision/route.ts`

## Consequences

- Satellites purchased without finance continue to use local staff master; provisioning is optional.
- Orchestrator never stores employee names or FIN—only `globalPersonId` references.
- Crypto keys (`PII_ENCRYPTION_KEY`, `PII_BLIND_INDEX_KEY`) must match between orchestrator MDM and finance for cross-system resolution.
