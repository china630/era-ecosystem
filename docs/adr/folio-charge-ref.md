# ADR: One folio charge key

**Status:** Accepted

**Date:** 2026-10-15

## Decision

Every satellite writes a hotel folio line with a key from `@era/satellite-kit/integration/folio-charge-ref`. The hotel stores that string on `FolioCharge.externalRef` and reads it with `parseFolioChargeRef`. Call sites do not invent a second prefix.

Stored spellings stay as they are:

| Source | Key |
|---|---|
| Clinic paid procedure | `clinic-ticket-{orderId}` |
| F&B ticket line | `{ticketId}:{lineId}` |
| Retail room charge | `{receiptId}:{lineId}` |
| Retail hub pending | `retail-{receiptId}-{lineId}` |
| Retail room return | `return:{receiptId}:{lineId}` |
| Prescription | `rx:{saleId}:{sku}` or `rx-return:{saleId}:{sku}` |

A `pay-` prefix is accepted only when reading an old row. Writers do not add it.

Clinic check-in and a no-show that keeps the charge mark `serviceReceivedAt` on that exact key. Hotel void of a clinic key calls the clinic with the same key. Default `Tenant.noShowKeepsCharge` is true, so a no-show cannot be voided.

A medical-rate checkout asks the clinic for paid lines and package sessions. Planned paid lines block checkout. Removing a line drops the charge; an existing overpayment is returned with the same cash or card choice as unused nights. A non-medical hotel does not ask.

`POST /api/cron/episode-hotel-checkout` (06:00 and 18:00 Asia/Baku, and once after clinic boot) opens a missing in-house course, closes a checked-out or departed guest, and copies package, room, name, sex, and birth date. The planned date does not close a course. Live check-in and check-out still go through the hotel outbox. See [hotel-clinic-lifecycle-outbox.md](./hotel-clinic-lifecycle-outbox.md).
