# ADR: CP workforce role templates and Security Admin (Plan C)

**Status:** Accepted (2026-06)  
**Context:** ERA v3 Workforce — hire and satellite access were split across Finance HR and satellite `local_master`.

**Related:** [cp-workforce-org-units.md](./cp-workforce-org-units.md), [workforce-identity-and-hr-provisioning.md](./workforce-identity-and-hr-provisioning.md), [clinic-domain-permissions-and-rbac.md](./clinic-domain-permissions-and-rbac.md) (satellite layer 4 — Phase A clinic), [cp-workforce-satellite-provision-sync.md](./cp-workforce-satellite-provision-sync.md) (deactivate target, provisionState, list pagination)

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
- `PATCH .../reprovision` with `satelliteKeys` (including `[]`) **replaces** that employment’s satellite set: revoke missing keys (`REVOKED` + `STAFF_DEACTIVATED`), upsert new (`HIRE_DEFAULT` + `STAFF_PROVISIONED`, role from the position template). Omitted `satelliteKeys` = classic fan-out of current bindings only.
- Workspace **Login & access** (Employments ⋯) is the per-person editor: Hotel / Clinic / F&B checkboxes, not a read-only list. Open for any non-terminated employment (no prior binding required). Save sends `satelliteKeys`.
- `GET .../employments` and `GET .../employments/:id` include **active** `roleBindings` (`satelliteKey`, `satelliteRole`, `provisionState`, `lastProvisionError`) so workspace overflow (Reprovision, Login & access) and the satellite filter work
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

The **role matrix** is position × satellite **default role**, not the current person. Per-person add/revoke is Login & access (or a manual grant). **Bindings** is a read-only journal: person column from MDM; org-unit filter parses `GET org-units` `{ items, scope }` (not a raw array).

## Consequences

- Clinic/F&B/Hotel provision handlers upsert by `cpEmploymentId`
- Plan C completes ERA v3 Workforce MVP (A absence + B org + C roles)
