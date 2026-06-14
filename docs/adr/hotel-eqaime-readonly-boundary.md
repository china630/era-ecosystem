# ADR: e-qaimə submission boundary (H-BL-24)

## Context

Operational invoices are issued in hotel PMS; legal e-qaimə submit to e-taxes.gov.az is an accounting/compliance act.

## Decision

- **Submission driver:** `era-hotel-pms/src/lib/services/eqaime.service.ts` (stub) — production path uses Finance worker + Asan İmza when `EQAIME_LIVE=true`.
- **Hotel UI:** read-only `FiscalDocument.eqaimeId`, `eqaimeStatus` on folio/invoice screens.
- **Event:** `SATELLITE_HOTEL_INVOICE_ISSUED` triggers Finance dispatch (future worker).

## Consequences

Hotel does not hold PKCS#12; Finance owns certs. Mock mode sufficient for Nafta UAT until accountant sign-off.
