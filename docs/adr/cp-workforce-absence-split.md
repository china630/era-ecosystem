# ADR: CP workforce absence split (Plan A)

**Status:** Accepted (2026-06)  
**Context:** ERA v3 Workforce — empty DB clean cut; no strangler migration.

## Decision

| Concern | Owner |
|---------|--------|
| Absence workflow (submit, approve, reject, cancel, overlap, audit) | **Orchestrator CP** (`WorkforceAbsence`, `WorkforceEmployment`) |
| Payroll math (30.4, sick staj, `syncAbsences`, gross) | **Finance** `hr_full` — read mirror + calculators |
| PII | **MDM** — CP stores `globalPersonId` + `employmentId` only |

Finance `Absence` rows are **mirrors** keyed by `cpAbsenceId`; manual CRUD removed from Finance API/UI.

## Events (BullMQ `era-satellite-events`)

| Type | When |
|------|------|
| `WORKFORCE_ABSENCE_APPROVED` | CP status → APPROVED |
| `WORKFORCE_ABSENCE_UPDATED` | dates/kind change on APPROVED |
| `WORKFORCE_ABSENCE_CANCELLED` | APPROVED → CANCELLED |

Payload: `@era/contracts` `workforceAbsenceEventPayloadSchema` (`cpAbsenceId`, `employmentId`, `globalPersonId`, optional `financeEmployeeId`, kind, dates).

Finance consumer: `workforce-absence-sync.service.ts` — no-op without `hr_full` or `financeEmployeeId`.

## Kind → Finance formula (consumer mapping)

| CP `kind` | `AbsenceType.code` / formula |
|-----------|------------------------------|
| `VACATION` | `LABOR_LEAVE` / `LABOR_LEAVE_304` |
| `SICK` | `SICK_LEAVE` / `SICK_LEAVE_STAJ` |
| `UNPAID` | `UNPAID_LEAVE` / `UNPAID_RECORD` |

## API surface

- CP: `/platform/v1/workforce/employments`, `/platform/v1/workforce/absences/*`
- Finance: `GET /hr/absences`, calculators; POST/PATCH/DELETE removed
- UI: Orchestrator `/workspace/workforce/*`; Finance payroll banner → Workspace

## Consequences

- Nafta can run absence workflow without Finance.
- Plan B adds `OrgUnit` + department-head scope; Plan C extends hire/provisioning from CP. Org structure ADR: [cp-workforce-org-units.md](./cp-workforce-org-units.md).
