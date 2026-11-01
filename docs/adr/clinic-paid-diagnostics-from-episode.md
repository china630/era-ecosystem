# ADR: Paid labs, diagnostics, and visits from the episode card

## Status

Accepted — 2026-10-31 · amended 2026-11-01 (package money + pay desk)

Related: [clinic-episode-procedure-assign-modal.md](./clinic-episode-procedure-assign-modal.md) · [clinic-extra-procedure-route.md](./clinic-extra-procedure-route.md) · [clinic-walk-in-party.md](./clinic-walk-in-party.md) · [clinic-diagnostic-catalog-db.md](./clinic-diagnostic-catalog-db.md)

## Context

Sanatorium revenue includes paid analyses, imaging (USG, ECG, …), and doctor visits beyond the package. Package assign already creates in-quota `LabOrder` / `Visit` documents. Over-quota labs were wrongly written as `ProcedureOrder` cheque rows, so they never became real lab work and barely appeared in the revenue statement as labs. A later bug stamped list price on package visits while `inPackage` stayed true, so the diagnostics tab showed **Ödə** on package burns.

## Decision

1. **Same money path as procedure extras, own clinical documents.** Paid lines are `LabOrder` (lab panels and instrumental studies) or `Visit` + `VisitServiceLine`. No cabin planner and no `PLAN_BEFORE_PAY` seating.
2. **No `PENDING_PAY` on `LabOrderStatus`.** Clinical status stays `ORDERED`. Payment uses `amountNet`, `settlementPendingId`, and `settledAt` (plus `inPackage`, `prescribedByPractitionerId`, `paymentReceiptRef`, reservation/room/origin on the header).
3. **Package burns always `amountNet = 0`.** Auto-apply and package-assign visits write 0 even if entitlement charge would return list price. Paid overflow uses `prescribeDiagnosticsExtras` (`forcePaid`). `listPendingDiagnostics` lists only `inPackage = false` (labs) / no inPackage lines (visits). Lazy heal zeroes mispriced package rows and drops unpaid paid duplicates when a package sibling exists.
4. **Lab journal is pay-gated.** Unpaid priced orders (`amountNet > 0`, `settledAt` null, not package) are absent from `GET /api/lab-orders`, card `pendingLabs`, and collect/results/publish/complete/blank/print APIs. After pay they appear as ordinary `ORDERED` work.
5. **Paid visits are work-gated the same way.** Unpaid priced visits refuse complete / CPOE write / diagnosis write / prescription until `settledAt` (409 `VISIT_AWAITING_PAYMENT`). Cancel and read stay open.
6. **Folio keys stay distinct.** Procedure extras keep `clinic-ticket-{id}`. Labs use `lab-ticket-{id}` / `sourceRef` `lab:{id}`. Visits use `visit-ticket-{id}`.
7. **UI — assign vs cash desk.** Diagnostics tab + modal are **assignment only** (master–detail like procedure assign: package menu left, selected right, draft totals). No **Pay** on the card or in the modal. Unpaid extras show status + delete; cash desk is `/reception/extra-tickets` (**Extra tickets** — procedures, labs, and visits). `prescribeDiagnosticsExtras` refuses when package remaining still covers the code (`QUOTA_REMAINING`).
8. **Intake checklist** prefers package documents (`inPackage`) so a paid duplicate never closes the package slot.
9. **Ready results and course print** list package and paid studies together once results exist. The episode summary print omits unpaid / not-ready lab rows.

## Consequences

- `prescribePaidLabOrders` (ProcedureOrder for lab codes) is removed; package-modal over-quota and the diagnostics modal call `prescribeDiagnosticsExtras`.
- Walk-in party and settlement-confirmed already understood `lab:` / visit settle — Extra tickets Pay stamps `settledAt` after folio accept.
- Reverse before `COLLECTED` clears `settledAt` so the order leaves the lab journal again.
- Acceptance stays SCREEN / 🟡 until UAT smoke on the diagnostics tab + Extra tickets.
