# ADR: Guest blank after the lab has already worked

## Status

Accepted — 2026-11-04

Related: [clinic-paid-diagnostics-from-episode.md](./clinic-paid-diagnostics-from-episode.md)

## Decision

`DiagnosticService.guestBlankRelease` is the switch. `PAY_WITH_WORK` keeps today's rule: a priced order stays off the lab journal until `settledAt`. `AFTER_PAYMENT` is for screens the sanatorium must run even when the package does not include them.

- Course open creates one order per such active service when none exists for the episode.
- A package line whose code matches the service stays `inPackage` and `amountNet = 0`, so the guest blank is available with the result.
- Otherwise the order is `releaseAfterPay` with the catalog list price. The lab journal, the staff patient card, collect, and result entry stay open. The course print and the guest blank stay closed until pay.
- A later paid prescribe of the same code does not create a second order. It keeps the existing row and, when that row is not in the package and not yet settled, writes the catalog price onto it.
- Price and which packages include the code stay catalog and package data. No service code is special-cased in the branch.

Reception day sheets live at `/reception/nurse-sheets`, not on the nurse board. The slice is explicit: all desk staff, one person, or one procedure type.
