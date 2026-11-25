# ERA Construction — Technical specification (TZ)

Product requirements: [PRD.md](./PRD.md). Delivery tracker: [doc/DELIVERY-CONSTRUCTION.md](./doc/DELIVERY-CONSTRUCTION.md).

## Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node 20+, Next.js 15 App Router |
| DB | PostgreSQL `era_construction` |
| ORM | Prisma 6 |
| Auth | `@era/satellite-kit` |
| Events | `@era/contracts` → `SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED` |
| UI | `@era/satellite-kit/ui` |

## Deployment

| Param | Value |
|-------|-------|
| Port | 3302 |
| Host | `construction.era-365.online` |
| Entitlement | `industry_construction` |

## Data model

```text
organizationId → Project
  ├→ BoqLine / ProgressAct → ProgressActLine
  ├→ ProjectParty / ProjectPhase / ProjectLocation
  ├→ Rfi / Submittal / SiteInspection / ChangeRequest
  └→ DailyLog / PunchListItem / DrawingRevision / … (ops; soft-delete deletedAt)
```

Plane map: [construction-domain-boundaries.md](../docs/adr/construction-domain-boundaries.md).  
Do not add Finance ledger tables here.

## API surface

| Method | Path | PRD |
|--------|------|-----|
| GET/POST | `/api/projects` | C-01 |
| GET/POST | `/api/projects/:id/boq` | C-01 / C-04 BOQ lines |
| GET/POST | `/api/projects/:id/acts` | C-03 draft act list/create |
| GET/POST/DELETE | `/api/projects/:id/parties` | M14 Wave 3 ops (party CRUD) |
| GET/POST/DELETE | `/api/projects/:id/phases` | M19 Wave 4 structure CRUD |
| GET/POST/DELETE | `/api/projects/:id/locations` | M19 Wave 4 structure CRUD |
| GET/POST/DELETE | `/api/projects/:id/gantt` | Schedule tasks |
| GET/POST | `/api/equipment/hours` | Equipment hours (`GET ?projectId=`) |
| GET/POST/PATCH/DELETE | `/api/projects/:id/subcontractor-claims` | Claims ops + status |
| GET/POST/PATCH | `/api/material-requisitions` | Requisitions + status transitions |
| GET/POST/PATCH | `/api/projects/:id/rfis` | M15 Wave 3 ops (answer + dueDate) |
| GET/POST/PATCH | `/api/projects/:id/submittals` | M17 Wave 3 ops (status transitions) |
| GET/POST/PATCH | `/api/projects/:id/inspections` | M18 Wave 3 ops (FAIL → punch) |
| GET/POST/PATCH | `/api/projects/:id/change-requests` | M16 Wave 3 ops (`financeContractId` ref only) |
| GET/POST | `/api/cde/documents` | M5 Wave 3 sheet lifecycle CURRENT/SUPERSEDED |
| GET/POST/PATCH | `/api/projects/:id/daily-logs` | M6 Wave 3 richer diary + submit |
| GET/POST/PATCH | `/api/projects/:id/punch-list` | M7 Wave 3 pin-to-CURRENT sheet + status transitions |
| GET/PUT | `/api/progress-acts/:id/lines` | M13 ops SOV lines |
| POST | `/api/progress-acts/:id/approve` | C-03 → progress act event (`construction:{actId}` journal) |
| PATCH | `/api/progress-acts/:id/finance-payapp` | Soft ref to Finance PayApplication id (ops only) |
| GET/PATCH/POST | `/api/projects/:id/estimate/*` | M20 dual mode, packages, finance-contract link, plan-fact |
| POST | `/api/estimate-packages/:id/documents` · `…/transition` | M20 pack docs + approve |
| PUT/POST | `/api/estimate-documents/:id/lines` · `…/lines/import-csv` | M20 lines + CSV import |
| GET/POST/PUT | `/api/rate-bases`, `/api/rate-bases/:id`, `/api/rate-bases/:id/items` | M21 rate bases CRUD (SKU `construction_smeta_rate_engine`; optional `materialCode`) |
| GET | `/api/rate-engine/materials` | Hub materials proxy (`platformConstructionMaterialsList`) |
| POST | `/api/rate-engine/calc`, `/api/rate-engine/apply` | M21 calc + apply into Estimate LCR/SC |
| POST | `/api/events/dispatch` | platform |

Progress-act approve payload: `projectId`, `actId`, `amountNet`, `currency: AZN`, optional `periodKey`, optional `lines[]`, optional `contractId`.  
Estimate approve event: `SATELLITE_CONSTRUCTION_ESTIMATE_PACKAGE_APPROVED` with `lines[]` + optional `financeContractId` → Finance SOV seed — [construction.events.ts](../packages/era-contracts/src/events/construction.events.ts).

## Finance / CP / CRM boundary

| Concern | Owner |
|---------|--------|
| Procurement, invoices, WIP journals, commercial contracts | **era-finance-core** |
| Timesheet month SoR / payroll mirror | **CP** → Finance ([workforce-timesheet-construction-bridge](../docs/adr/workforce-timesheet-construction-bridge.md)) |
| Lead → convert → payment | **era-crm** → Finance |

See [doc/clone-spec/01-finance-boundary.md](./doc/clone-spec/01-finance-boundary.md).
