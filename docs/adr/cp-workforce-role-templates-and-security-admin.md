# ADR: CP workforce role templates and Security Admin (Plan C)

**Status:** Accepted (2026-06)  
**Context:** ERA v3 Workforce — hire and satellite access were split across Finance HR and satellite `local_master`.

**Related:** [cp-workforce-org-units.md](./cp-workforce-org-units.md), [workforce-identity-and-hr-provisioning.md](./workforce-identity-and-hr-provisioning.md)

## Three access layers

| Layer | Owner | Answers |
|-------|-------|---------|
| **WorkforcePosition** | CP | Cadre placement in org unit |
| **SatelliteRoleTemplate** | CP | Default operational role per product |
| **RoleBinding / ManualGrant** | CP | Effective access + exceptions |
| **Domain permission** | Satellite | In-app capabilities (`permissionsJson`, route guards) |

CP publishes **`STAFF_PROVISIONED` / `STAFF_DEACTIVATED`** with **`cpEmploymentId`** (v2 payload). Finance no longer emits staff events.

## Hire master

- `POST /platform/v1/workforce/employments/hire` — employment + seat + bindings + provision
- `POST .../terminate`, `PATCH .../reprovision`
- `WorkforceSeatAllocation` — 1 seat per `globalPersonId` per scope
- `WorkforceAssignment` registry keyed by `cpEmploymentId`

## Workforce policy

`hireMode: cp_workforce | disabled` when `platform_workforce` + entitled `industry_*`.  
Deprecated: `finance_hr`, `local_master`.

## Finance

Optional payroll mirror on `WORKFORCE_EMPLOYMENT_HIRED` → `Employee.cpEmploymentId`.  
Employee create no longer sets `provisionedSatellite*` or emits staff events.

## Security Admin UI

`/workspace/workforce/security` — seats, bindings, audit tail; role matrix via `/role-templates`.

## Consequences

- Clinic/F&B/Hotel provision handlers upsert by `cpEmploymentId`
- Plan C completes ERA v3 Workforce MVP (A absence + B org + C roles)
