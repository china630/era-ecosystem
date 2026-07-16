# DELIVERY-FINANCE

Finance core — quartet product path (Track C).

## FIN-CP — Control plane auth

- [x] `ERA_AUTH_MODE=control-plane` — CP guards, billing summary smoke
- [x] Industry launcher — Hot/FB deep links + SSO (`industry-modules.ts`)
- [x] Memberships **Live** — `GET /api/auth/me` + `POST /api/auth/switch` proxy to Orch when `ERA_AUTH_MODE=control-plane`
- [x] RBAC join/access/transfer — proxy to Orch (`ERA_CONTROL_PLANE_RBAC_PROXY`)

## FIN-E8 — Satellite ingress

- [x] 13 legacy `@era/contracts` ingress types → worker
- [x] **FB-10** `SATELLITE_FB_STOCK_CONSUMPTION_COMPLETED` → COGS/WIP journal (`satellite-event-dispatch.service.ts`)
- [x] **FB sale/shift** `SATELLITE_FB_SALE_COMPLETED` → revenue journal (idempotent `fb-sale:{receiptId}`); `SATELLITE_FB_SHIFT_CLOSED` → cash recon stub
- [x] Finance registration → MDM full cutover — `ERA_MDM_REGISTRATION_CUTOVER` redirects to Orchestrator

## FIN-HR-ABS — Payroll absence mirror (Plan A)

- [x] `GET /api/hr/absences` — read-only mirror from CP (`cpAbsenceId`)
- [x] Calculators + `syncAbsences` unchanged
- [~] Absence **workflow** moved to Orchestrator CP — POST/PATCH/DELETE removed; payroll UI banner → Workspace
- [x] Consumer `WORKFORCE_ABSENCE_*` in `workforce-absence-sync.service.ts`

## FIN-HR-CC — CostCenter org mirror (Plan B)

- [x] `Department.cpOrgUnitId`, `JobPosition.cpPositionId`, `Employee.cpEmploymentId` schema
- [x] `GET /api/hr/departments`, `GET /api/hr/job-positions` — read-only mirror
- [x] POST/PATCH department and job-position mutations removed from API
- [x] Consumer `WORKFORCE_ORG_UNIT_*`, `WORKFORCE_POSITION_*`, `WORKFORCE_EMPLOYMENT_TRANSFERRED` in `workforce-org-sync.service.ts`
- [x] `/hr/structure`, `/hr/positions` — read-only UI + banner → Workspace
- [x] `DepartmentHeadScopeService` — stable `cpEmploymentId` + `managerEmploymentId` subtree

## FIN-HR-HIRE — CP employment payroll mirror (Plan C)

- [x] `WORKFORCE_EMPLOYMENT_HIRED` consumer creates minimal `Employee` with `cpEmploymentId`
- [x] Finance employee create no longer emits `STAFF_PROVISIONED` or accepts provision fields

## FIN-HR-PII — MDM person read-through (Plan D)

- [x] `Employee` schema — payroll-only; `globalPersonId` required; no plaintext FIN/name
- [x] `POST /api/hr/employees/resolve-person` + create requires `globalPersonId`
- [x] List/get enrich person via MDM batch ops-profile; employee modals read-only person + payroll banner
- [x] HR services (timesheet, payroll, absences, org-structure) display via `employee-person.util`

## Quartet smoke

- [x] `GET /api/health` — `scripts/quartet-smoke.mjs`
- [x] CP login → `/cp` billing — [SETUP_AND_RUN.md](../../docs/SETUP_AND_RUN.md)

## Track A

- [x] Documented in [QUARTET_UAT.md](../../docs/QUARTET_UAT.md)
