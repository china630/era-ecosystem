# ADR: Evrostar field-workforce pilot (group HR, labor roster, statutory vs management books)

- **Status:** Accepted (documentation; implementation by wave)
- **Date:** 2026-09-17
- **Product:** Control plane Workforce (`era-orchestrator`) + Finance (`era-finance-core`) + MDM
- **Pilot customer:** Evrostar / Evrostar Group (cleaning, ~240 employees × 2 VÖEN)
- **Amends:** [cp-workforce-org-units.md](./cp-workforce-org-units.md),
  [cp-core-workforce-hub.md](./cp-core-workforce-hub.md),
  [cp-personnel-orders.md](./cp-personnel-orders.md),
  [workforce-dual-audit.md](./workforce-dual-audit.md),
  [finance-accounting-book.md](./finance-accounting-book.md),
  [holdings-control-plane.md](./holdings-control-plane.md)

Commercial pack: [`docs/commercial/ERA-Workforce-Evrostar-AZ.html`](../commercial/ERA-Workforce-Evrostar-AZ.html). Workforce Premium does **not** include payroll, GL, or warehouse — those are paid Finance modules (`hr_full`, NAS, inventory) plus an extra accounting-book slot for MANAGEMENT.

## Context

Evrostar and Evrostar Group are two legal employers (two VÖEN) under one operational group. Headcount per entity stays under the typical Azerbaijan medium-enterprise ~250-employee threshold. They need hire/terminate/leave, timesheets, object/brigade shifts, manager access, official payroll, chemicals/PPE inventory, and later FaceID tablets.

Existing product vs the sale:

- `WorkforceScope.anchorOrganizationId` is unique; multi-VÖEN HR was “future”.
- `/staff-schedule` is ştat snapshots, not a shift roster. Hotel HK and clinic nurse-roster are satellite **duty posting**, not labor hours.
- Personnel orders are HIRE / TRANSFER / TERMINATE with a generic pdfkit page.
- `WorkforceAuditLog` exists but does not cover every workforce mutation.
- `AccountingBook` already has NAS / IFRS / MANAGEMENT and `isDefaultOps`. The pilot freezes **NAS = state + official money**, **MGMT = internal cost** — not IFRS, not a second cash engine.

## Decision

### 1. Tenancy and group HR

| Layer | Shape |
|-------|--------|
| Commercial | Two `STANDALONE` orgs + one `Holding` |
| Workforce | Two `WorkforceScope` (one per anchor org) |
| Person | One MDM `globalPersonId`; one or two `WorkforceEmployment` (one per VÖEN) |
| Finance | Same two `organizationId`; separate payroll, NAS, inventory |

**Forbidden:** Group as `DEPARTMENT` of Evrostar; one OrgUnit tree spanning two VÖEN; one payroll run or one warehouse **owner** for the group.

Day-one UX: org switcher. Later optional **holding-federated view** (read-union of two scopes; person card shows both employments). Writes always carry `organizationId`. Import `ADDITIONAL` workplace remains an intra-scope second job, not the cross-VÖEN case.

### 2. Labor roster on CP (new module)

CP owns **when people work** (labor). Satellites keep **what they do on duty** (floors, devices).

Primitives (closed constructor, not a script DSL):

1. `ShiftType` — clock window, break, night flag, hours.
2. `ShiftCycle` — repeating pattern (5/2, 2/2, 24/48, custom N-day tape). Closest existing engine: clinic CLI-36.
3. `Place` — client site / post. **Not** an `OrgUnit`. Optional `responsibleOrgUnitId`.
4. `ShiftAssignment` — employment or brigade × place × cycle × type, `effectiveFrom` / `effectiveTo` (regime change = new assignment).
5. **Brigade membership** (dated, not a snapshot) — employment × brigade × `effectiveFrom` / `effectiveTo`; transfer editor. Canon: [cp-workforce-brigade-membership.md](./cp-workforce-brigade-membership.md). Intervals + transfer API/UI landed; capability remains API / SCREEN (not SHIPPED).
6. Day override — swap / extra / off.

Materialize into CP `WorkforceTimesheet` DRAFT cells. Approved month remains attendance SoR for Finance (`WORKFORCE_TIMESHEET_APPROVED`). Plan ≠ fact.

`OrgUnit` filters the grid (home department). Changing site for a day is not an employment transfer.

**Out of this ADR:** migrating hotel `/hk/roster` or clinic `/sanatorium/nurse-roster` onto CP. Later they may consume CP “who is on shift”; they must not become the labor SoR.

FaceID: last wave; vendor-agnostic webhook (`personRef + placeId + in/out` → DRAFT). Manual timesheet first.

### 3. Personnel orders

Extend types at least `HIRE`, `TERMINATE`, `TRANSFER`, `LEAVE_ANNUAL`. Org- or holding-default templates (az/ru) with placeholders. Snapshot context JSON at ISSUED so reprints do not drift.

Leave remaining comes from Finance `vacationDaysBalance` via `cpEmploymentId` (no second formula on CP). If `hr_full` is off, the variable is empty.

Issue path: the HR mutation produces or requires a DRAFT order; ISSUED is the legal document. Number series per **legal entity + type**. Load the customer’s hire / terminate / leave blanks; do not invent layouts.

`/staff-schedule` stays ştat (vacancies), not the labor calendar.

### 4. Workforce audit

Closed `action` catalog. Every CP workforce mutation logs. Required: `organizationId`, `workforceScopeId`, `actorUserId`, plus `globalPersonId` / `cpEmploymentId` when a person is in scope; payload before/after.

Must add vs today: roster import apply; timesheet autofill / sync / batch (one summary row per batch); staff-schedule submit; order cancel; PDF download.

Do not merge with satellite folio audit. Finance money stays on Finance audit, correlated by `cpEmploymentId`. Holding audit UX = filter union of two `organizationId`, not one log table for the group.

### 5. Statutory vs management books (Finance)

Per legal entity:

| Book | Role |
|------|------|
| NAS, `isDefaultOps`, included slot | Official documents, cash, bank, stock, official payroll, e-taxes / DSMF / salary XML / state period close |
| MANAGEMENT, extra slot (`accounting_book_extra`) | Internal cost: full labor, site margin. Never tax export, never payment execution |

`isDefaultOps` **remains NAS**. Do not retarget ops to MGMT.

Official payroll posts only to NAS. Employee carries **contract salary** (statutory) and **internal rate** (management). After timesheet approve, post **delta labor cost only into MGMT**. No MGMT cash/bank disbursement, no second DSMF file, no off-register pay control.

MGMT is **NAS + deltas** (optional CoA clone / periodic copy), not a second ERP and not per-line «вид учёта».

Access: state accountant → NAS + payments; owner / management role → MGMT + compare-books. Both books sit in the same SaaS tenant — hide MGMT with RBAC; do not market a “hidden ledger”.

Inventory: two **owners** (one per org). Multiple `Warehouse` rows per org are allowed (base + sites). No shared holding stock.

Holdings reports compare like `bookCode` (NAS↔NAS, MGMT↔MGMT).

### 6. Delivery waves

| Wave | Content |
|------|---------|
| 0 | Two orgs + holding; hire/terminate/leave; Finance employment mirror (`WORKFORCE_EMPLOYMENT_HIRED` / `TERMINATED`, ensure-org, `financeEmployeeId` write-back). Runbook: [evrostar-wave-0.md](../runbooks/evrostar-wave-0.md). |
| 1 | Month timesheet + official payroll + NAS postings + bank XML. Finance timesheet header APPROVED on CP approve; contract salary gate + bulk; CP grid pagination/chunked autofill. Runbook: [evrostar-wave-1.md](../runbooks/evrostar-wave-1.md). |
| 2 | Places, brigades, shift constructor (plan only; timesheet is not painted from the roster). Runbook: [evrostar-wave-2.md](../runbooks/evrostar-wave-2.md). |
| 3 | Holding-federated HR view (optional parallel with 2). Runbook: [evrostar-wave-3.md](../runbooks/evrostar-wave-3.md). |
| 4 | Order templates + leave variable; audit holes |
| 5 | NAS frozen as ops + MGMT book + internal rate + MGMT labor delta; warehouse per org | Runbook: [evrostar-wave-5.md](../runbooks/evrostar-wave-5.md). Eng done; COVERAGE API. |
| 6 | FaceID webhooks → DRAFT (`source=faceid`). Runbook: [evrostar-wave-6.md](../runbooks/evrostar-wave-6.md). Eng done; COVERAGE API (not SHIPPED). |
| 7 | ƏMAS / portal — file + extension prefill (`PENDING_MANUAL`). Runbook: [evrostar-wave-7.md](../runbooks/evrostar-wave-7.md). S2S still 503. COVERAGE STUB. |

Edition / Product-Readiness stay `mvp` until Lab RT + field signoff. Pilot hardens the product; SKU on ≠ GA.

## Non-goals

- Servicing undeclared-wage **payment** (cash/bank/payroll XML from MGMT).
- Merged HR tree or merged GL across VÖEN.
- Arbitrary shift programming language / staffing optimizer.
- Moving HK floor sheets or nurse-device posting to CP.
- IFRS unless purchased.
- Native FaceID vendor SDK in waves 0–5.
- Word-class template designer in wave 4 (HTML/DOCX placeholders).

## Consequences

- CP schema (waves 2–4): places, shift types/cycles, assignments, overrides; order template store; audit action enum. Brigade **membership intervals** landed — [cp-workforce-brigade-membership.md](./cp-workforce-brigade-membership.md) (API / SCREEN, not SHIPPED).
- Finance (wave 5): internal rate on employee or payroll profile; MGMT-only labor delta journal; guards so tax and payments cannot select MGMT.
- Billing: two orgs × (Workforce Premium headcount meter + `hr_full` + NAS + inventory + MGMT extra book).
- COVERAGE / matrices: planned rows only; no SHIPPED / Pilot / `ga` from this ADR.
- Company Excel pack loads through a stepped wizard, not CP-WF-IMP-01 — [cp-workforce-migration-center.md](./cp-workforce-migration-center.md) (implementation landed; API + SCREEN, not SHIPPED).

## Related

- [cp-workforce-brigade-membership.md](./cp-workforce-brigade-membership.md)
- [cp-workforce-migration-center.md](./cp-workforce-migration-center.md)
- [workforce-timesheet-construction-bridge.md](./workforce-timesheet-construction-bridge.md)
- [workforce-compliance-emas-boundary.md](./workforce-compliance-emas-boundary.md)
- [workforce-seat-licensing.md](./workforce-seat-licensing.md)
- [clinic-practitioner-shifts.md](./clinic-practitioner-shifts.md)
- [org-operating-mode.md](./org-operating-mode.md)
