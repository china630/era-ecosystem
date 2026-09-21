# ADR: CP personnel orders and staff schedule

- **Status:** Accepted
- **Date:** 2026-07-13  
- **Amended:** 2026-09-17 — templates / leave / issue path ([evrostar-workforce-pilot.md](./evrostar-workforce-pilot.md))
- **Context:** Tender HR requires printable hire/transfer/terminate orders and approved ştat cədvəli. PII stays in MDM; operational employment lives in CP Workforce.

## Decision

1. **`WorkforcePersonnelOrder`** in Orchestrator DB — legal document over hire/transfer/terminate/leave (not a post-hoc PDF). MVP types in code: HIRE / TRANSFER / TERMINATE. **Pilot deepen** ([evrostar-workforce-pilot.md](./evrostar-workforce-pilot.md)): add at least `LEAVE_ANNUAL`; org- or holding-default **templates** (az/ru placeholders); **snapshot JSON at ISSUED**; number series per **legal entity + type**. Leave remaining is read from Finance `vacationDaysBalance` via `cpEmploymentId` (no second CP formula).
2. **`StaffScheduleRevision`** — DRAFT → SUBMITTED → APPROVED snapshot of positions × occupied/vacant (`totalSlots` vs active employments). PDF printable. This is **ştat**, not the labor shift roster.
3. Finance does **not** master these documents; continues to mirror org/positions via `WORKFORCE_*` events for payroll CostCenters only.
4. APIs: `GET/POST /platform/v1/workforce/personnel-orders`, `…/:id/pdf`, `GET/POST /platform/v1/workforce/staff-schedule`, `…/:id/approve|submit|pdf`.
5. Issue path (pilot): HR mutation produces or requires a DRAFT order; ISSUED is the printable legal act. `CANCELLED` must be a real API, not enum-only.

## Consequences

- HR document generation lives in control plane (correct boundary).
- No duplicate order/staff-schedule tables in Finance.
- Related: [cp-workforce-pii-tiers.md](./cp-workforce-pii-tiers.md), [cp-core-workforce-hub.md](./cp-core-workforce-hub.md), [evrostar-workforce-pilot.md](./evrostar-workforce-pilot.md).
