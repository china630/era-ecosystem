# ADR: CP workforce org units (Plan B)

**Status:** Accepted (2026-06)  
**Context:** ERA v3 Workforce — three meanings of "department" were conflated. Empty DB clean cut.

**Related:** [org-operating-mode.md](./org-operating-mode.md), [cp-workforce-absence-split.md](./cp-workforce-absence-split.md), [workforce-identity-and-hr-provisioning.md](./workforce-identity-and-hr-provisioning.md)

## Three layers (terminology)

| Term | Owner | Master for | Not the same as |
|------|-------|------------|-----------------|
| **Organization** (commercial) | Orchestrator CP | billing, VÖEN, SSO, `operatingMode`, revenue/fiscal routing | HR org tree |
| **OrgUnit** (workforce tree) | Orchestrator CP | reporting lines, hire placement, approver subtree scope | commercial `DEPARTMENT` org |
| **CostCenter** | Finance (`Department`) | GL `Transaction.departmentId`, payroll grouping | satellite ops permissions |

## Decision

1. **OrgUnit + WorkforcePosition** are mastered in CP (`WorkforceScope`, `OrgUnit`, `WorkforcePosition`).
2. **Finance `Department` / `JobPosition`** are **read/sync mirrors** via events (`cpOrgUnitId`, `cpPositionId`); Finance CRUD UI/API for org structure removed.
3. **Commercial `Organization` DEPARTMENT** (clinic under hotel VÖEN) remains billing/routing only — optional `OrgUnitCommercialLink` maps commercial org → workforce scope/subtree.
4. **WorkforcePosition** links to **SatelliteRoleTemplate** (Plan C): position × entitled satellite → default operational role code.
5. **Salary bands** (`minSalary`/`maxSalary`) stay on Finance `JobPosition` mirror; CP positions carry slots only.
6. **DEPARTMENT_HEAD scope** uses stable ids: `OrgUnit.managerEmploymentId` + subtree, not Finance name cipher match.

## CP schema (summary)

- `WorkforceScope` — anchor on parent `STANDALONE` commercial org
- `OrgUnit` — tree with `managerEmploymentId`, `managerUserId` (interim)
- `WorkforcePosition` — slots per org unit
- `WorkforceEmployment` — requires `orgUnitId` + `positionId` for ACTIVE hire

Bootstrap: `POST /platform/v1/workforce/scope/bootstrap` → scope + root "Headquarters" (renameable).

## Events

| Type | Finance consumer |
|------|------------------|
| `WORKFORCE_ORG_UNIT_UPSERTED` | upsert `Department` mirror |
| `WORKFORCE_ORG_UNIT_ARCHIVED` | soft-delete mirror |
| `WORKFORCE_POSITION_UPSERTED` | upsert `JobPosition` (slots; salary defaults 0) |
| `WORKFORCE_EMPLOYMENT_TRANSFERRED` | update `Employee.positionId` when `financeEmployeeId` present |

Payloads: `@era/contracts` `workforceOrgUnitPayloadSchema`, `workforcePositionPayloadSchema`, `workforceEmploymentTransferPayloadSchema`.

## API / UI

- CP: `/platform/v1/workforce/{scope,org-units,positions,commercial-links}`, employment `transfer`
- CP UI: `/workspace/workforce/org-structure`, `/positions`, employments hire requires org unit + position
- Finance: `GET /hr/departments`, `GET /hr/job-positions`; banners → Workspace

## Nafta example

One HR tree under parent scope (Sanatorium → Med / Admin / F&B). Clinic and F&B **commercial** orgs for billing; optional subtree links deferred in MVP (`SCOPE_ROOT` on parent only).

## Consequences

- Payroll departmental GL unchanged — uses mirrored `departmentId`.
- Plan C: full hire/provisioning in CP; Finance `Employee` is payroll extension only (`cpEmploymentId` link). See [cp-workforce-role-templates-and-security-admin.md](./cp-workforce-role-templates-and-security-admin.md).
- Multi-scope enterprise (unrelated VÖEN trees) — future; MVP one scope per anchor org.
