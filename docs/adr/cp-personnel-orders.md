# ADR: CP personnel orders and staff schedule

- **Status:** Accepted
- **Date:** 2026-07-13
- **Context:** Tender HR requires printable hire/transfer/terminate orders and approved ştat cədvəli. PII stays in MDM; operational employment lives in CP Workforce.

## Decision

1. **`WorkforcePersonnelOrder`** (HIRE / TRANSFER / TERMINATE) in Orchestrator DB — document workflow over existing hire/transfer/terminate mutations. Stores `orderNumber`, `effectiveDate`, optional `personDisplayName` snapshot for print (not vault PII), PDF via pdfkit.
2. **`StaffScheduleRevision`** — DRAFT → SUBMITTED → APPROVED snapshot of positions × occupied/vacant (`totalSlots` vs active employments). PDF printable.
3. Finance does **not** master these documents; continues to mirror org/positions via `WORKFORCE_*` events for payroll CostCenters only.
4. APIs: `GET/POST /platform/v1/workforce/personnel-orders`, `…/:id/pdf`, `GET/POST /platform/v1/workforce/staff-schedule`, `…/:id/approve|submit|pdf`.

## Consequences

- HR document generation lives in control plane (correct boundary).
- No duplicate order/staff-schedule tables in Finance.
- Related: [cp-workforce-pii-tiers.md](./cp-workforce-pii-tiers.md), [cp-core-workforce-hub.md](./cp-core-workforce-hub.md).
