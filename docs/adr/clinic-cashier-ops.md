# Clinic cashier ops (CLI-33)

## Context

/cashier was a prototype (manual visitId, open-shift-only, cash-only pay). Sanatorium guests (IN_HOUSE) and hub walk-ins never belonged on local cashier — billing already routed via billing-router to hotel folio or settlement hub. This wave turns cashier into a real ops workplace that respects all three channels.

## Decision

1. **Unified bill** per completed visit aggregates VisitServiceLine + linked LabOrderItem + charged ProcedureOrder lines. **Zero-amount lines are skipped** (in-quota package fulfillment); positive lab/visit/procedure lines are included.
2. **Entitlement pricing (W3):** `resolveEntitlementCharge` prefers `ServiceCatalogCache.listAmount` over commercial `amount`. Walk-in always paid; in-quota package → 0; over-quota / no package → list price; missing list → `priceMissing` (procedure path may fall back to `DEFAULT_OVER_QUOTA_AZN` only when a charge must post). Episode `noPackageConfirmedAt` → paid (reversible via `DELETE …/confirm-no-package`, and cleared when a `ProgramInstance` appears); `NO_PROGRAM_CODE` without confirm → `awaiting_package` (0, not charged yet, but written to `ProcedureChargeLog` via `forceLog` so the cashier sees the unbilled backlog). `applyPriceMissingFallback` extends the `DEFAULT_OVER_QUOTA_AZN` guard to labs and intake/auto-apply visits — a paid line is never persisted at 0 just because the catalog lacks `listAmount`.
3. **Channel-aware settle** (ClinicReceiptChannel):
   - LOCAL — clinic receipt + @era/fiscal mock + optional payment split (ClinicReceiptPayment)
   - HOTEL_FOLIO — postHotelRoomCharge (no local fiscal)
   - SETTLEMENT_HUB — postHotelSettlementPending (hotel Front Cash)
4. **Shift lifecycle** — idempotent current open shift; X-report live; Z-report snapshot on close (zReportJson).
5. **Over-quota visibility** — ProcedureChargeLog on procedure complete/no-show; standalone path can settle locally from cashier tab.
6. **History** — receipt list with VOID (local only) and reprint counter.

## Schema

- Enums: ClinicReceiptChannel, ClinicReceiptLineSource
- ClinicReceipt gains channel, gross/discount, void fields, patientRef
- ClinicReceiptPayment for split tender
- ProcedureChargeLog for sanatorium over-quota / folio audit
- `ServiceCatalogCache.listAmount` (W3 retail list for over-quota / walk-in)

## Non-goals

- Real NBC/Cybernet fiscal remains STUB (CLI-24) until cert.
- Hotel-side void of folio/hub charges stays on hotel Front Cash.

## Consequences

Cashier UI is table + modal (same pattern as lab-orders). Deep link /cashier?visitId= opens settle modal. Settle path: POST /api/cashier/bills/:visitId/settle.
