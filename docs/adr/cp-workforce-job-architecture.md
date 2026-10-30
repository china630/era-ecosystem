# ADR: Workforce job architecture (five axes)

**Status:** Accepted (implementing)  
**Date:** 2026-10-29  
**Updated:** 2026-10-30 — full axes + resolve + routes + UI quality bar  
**Products:** `era-orchestrator` (CP workforce)  
**Related:** [cp-workforce-org-units.md](./cp-workforce-org-units.md) · [cp-workforce-hr-routes.md](./cp-workforce-hr-routes.md) · [cp-workforce-floor-attendance.md](./cp-workforce-floor-attendance.md)

## Context

Operators confuse **org-unit nesting** with **who ranks above whom** and with **how valuable a job is**. Buffet management eaters, advance routes, and future pay bands need clear vocabulary. Advanced HRIS (Oracle HCM, SAP SuccessFactors, Workday) keep these as separate axes. ERA implements the same split as a universal product — not a Nafta-only shortcut.

## Decision

ERA documents **five axes**. Do not collapse them into the OrgUnit tree alone. Do **not** infer rank or approval rights from `parentId` depth.

| Axis | Meaning | ERA |
|------|---------|-----|
| **A — Org unit tree** | Legal / cost-center nesting | `OrgUnit.parentId`, `unitKind` (`COMPANY` / `DIVISION` / `DEPARTMENT` / `TEAM`). Indent in UI is **display-only**. |
| **B — Position slot** | Seat in a unit | `WorkforcePosition` — slots, `leadership`, tariff/regime/hours, optional `jobId`, `parentPositionId` |
| **C — Job + grade** | Catalog role value | `WorkforceJob`, `WorkforceGrade` (`level` Int). Nullable `minSalary`/`maxSalary` reserved; **UI does not edit bands** (payroll SoR = Finance). |
| **D — Position hierarchy** | Structural chart incl. vacancies | `WorkforcePosition.parentPositionId` (cycle forbidden) |
| **E — Reporting** | Who manages this person | `OrgUnit.managerEmploymentId`; employment `managerEmploymentId` (solid) + `matrixManagerEmploymentId` (dotted) |

**Operational flags:** `WorkforcePosition.leadership` stays for buffet eaters and route audience (`ALWAYS` / `LEADERSHIP` / `ORDINARY`). Grade level does not replace leadership.

### Line manager resolve

```
lineManager(employment):
  1. employment.managerEmploymentId if ACTIVE and != self
  2. else OrgUnit.managerEmploymentId / managerUserId on the unit, walking parentId (skip self), max 24
  3. else null
managerChain(n) = apply lineManager n times
```

### Approval step kinds

| Kind | Resolve |
|------|---------|
| `REQUESTER_MANAGER` | `lineManager` |
| `ORG_UNIT_HEAD` | unit manager only (no employment override) |
| `POSITION_IN_UNIT` | ACTIVE on position in named unit |
| `MANAGER_CHAIN` | `managerChain(chainOffset)`; null offset → 2 |
| `POSITION_HOLDER` | ACTIVE on `positionId` anywhere in scope |
| `MATRIX_MANAGER` | `matrixManagerEmploymentId` |
| `GRADE_AT_LEAST` | ACTIVE with `position.job.grade.level >= minGradeLevel`; no job/grade → empty → `APPROVAL_STEP_UNASSIGNED` |

### API / UI surfaces

- Grades / jobs CRUD; position `jobId` + `parentPositionId`; employment reporting PATCH; org-chart `GET ?mode=units|positions|people`
- UI: `/workspace/workforce/org-structure` (manager + unitKind), `/positions`, `/job-architecture`, `/org-chart`, employment card managers, hr-settings step kinds
- Quality bar: no stub handlers; Nest DTO whitelist; CatalogField for pick-lists; list shell kit patterns; i18n en+az+ru

### Coverage

`CP-WF-JOB-01` Status=**API** until UAT-SMOKE. Not SHIPPED / Pilot / edition `ga`.

## Consequences

- Prefer `leadership`, grade level, and explicit manager links for eligibility — never tree depth.
- Finance `JobPosition` remains a CostCenter mirror; unknown event fields (`jobId`, `parentPositionId`) are ignored until Finance opts in.
- Archive grade is forbidden while any job references it.
- Dual-VÖEN trees stay separate scopes ([evrostar-workforce-pilot.md](./evrostar-workforce-pilot.md)).

## Non-goals

- Talent / KPI / succession
- Full N-edge people graph (solid + matrix only)
- Finance payroll band sync in this wave
- Nafta Excel load (full roster / absences / grades — separate; leadership flags from IR «Vəzifələr» may be applied as a one-shot ops patch)

## Deferred debt (backlog)

| ID | Item | Notes |
|----|------|-------|
| **S-WF-JOB-BANDS** | Salary bands on grade UI | Edit `WorkforceGrade.minSalary` / `maxSalary` on `/job-architecture`. Do **not** ship empty money fields as live. Payroll SoR stays Finance; prefer a later Finance band sync before or with this UI. |
| **S-WF-JOB-CHART-DND** | Drag-edit org chart | DnD rewrite of `OrgUnit.parentId` / `WorkforcePosition.parentPositionId` on `/org-chart` using existing cycle/self guards. Chart stays **read-only** until then; hierarchy is edited via forms. |
