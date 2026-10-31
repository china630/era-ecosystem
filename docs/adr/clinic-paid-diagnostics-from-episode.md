# ADR: Paid labs, diagnostics, and visits from the episode card

## Status

Accepted — 2026-10-31

Related: [clinic-episode-procedure-assign-modal.md](./clinic-episode-procedure-assign-modal.md) · [clinic-extra-procedure-route.md](./clinic-extra-procedure-route.md) · [clinic-walk-in-party.md](./clinic-walk-in-party.md) · [clinic-diagnostic-catalog-db.md](./clinic-diagnostic-catalog-db.md)

## Context

Sanatorium revenue includes paid analyses, imaging (USG, ECG, …), and doctor visits beyond the package. Package assign already creates in-quota `LabOrder` / `Visit` documents. Over-quota labs were wrongly written as `ProcedureOrder` cheque rows, so they never became real lab work and barely appeared in the revenue statement as labs.

## Decision

1. **Same money path as procedure extras, own clinical documents.** Paid lines are `LabOrder` (lab panels and instrumental studies) or `Visit` + `VisitServiceLine`. No cabin planner and no `PLAN_BEFORE_PAY` seating.
2. **No `PENDING_PAY` on `LabOrderStatus`.** Clinical status stays `ORDERED`. Payment uses `amountNet`, `settlementPendingId`, and `settledAt` (plus `inPackage`, `prescribedByPractitionerId`, `paymentReceiptRef`, reservation/room/origin on the header).
3. **Lab journal is pay-gated.** Unpaid priced orders (`amountNet > 0` and `settledAt` null) are absent from `GET /api/lab-orders`, card `pendingLabs`, and collect/results/publish/complete/blank/print APIs. After pay they appear as ordinary `ORDERED` work. Package lines stay `amountNet = 0` and are visible immediately.
4. **Paid visits are work-gated the same way.** Unpaid priced visits refuse complete / CPOE write / diagnosis write / prescription until `settledAt` (409 `VISIT_AWAITING_PAYMENT`). Cancel and read stay open.
5. **Folio keys stay distinct.** Procedure extras keep `clinic-ticket-{id}`. Labs use `lab-ticket-{id}` / `sourceRef` `lab:{id}`. Visits use `visit-ticket-{id}`.
6. **UI entry** is the patient-card **diagnostics** tab: package remaining + red unpaid rows with **Pay/delete on the card**; modal chrome cloned from procedure assign (`ModalShell`, `CatalogField`, kit `Field`/`DatePicker`, plus/minus). Catalog options show kind in the label. Visit draft schedule is editable. Visit **date** may stamp an appointment; **time** is optional (UI does not invent `09:00` in the draft — date-only goes to the API as `YYYY-MM-DD`; server may default clinic `09:00` Baku for the appointment instant).
7. **Ready results and course print** list package and paid studies together once results exist. The episode summary print omits unpaid / not-ready lab rows.

## Consequences

- `prescribePaidLabOrders` (ProcedureOrder for lab codes) is removed; package-modal over-quota and the diagnostics modal call `prescribeDiagnosticsExtras`.
- Walk-in party and settlement-confirmed already understood `lab:` / visit settle — in-house Pay stamps `settledAt` after folio accept.
- Reverse before `COLLECTED` clears `settledAt` so the order leaves the lab journal again.
- Acceptance stays SCREEN / 🟡 until UAT smoke on the diagnostics tab.
