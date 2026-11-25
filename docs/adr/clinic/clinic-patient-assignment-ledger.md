# ADR: Patient assignment ledger report

## Status

Accepted — 2026-11-01

Related: [clinic-paid-diagnostics-from-episode.md](./clinic-paid-diagnostics-from-episode.md) · [clinic-extra-procedure-route.md](./clinic-extra-procedure-route.md)

## Context

Ops need one course-scoped list of everything assigned to a guest: package and paid procedures, labs/imaging, and visits — with assigned vs fully completed counts, schedule time, room, and money only after payment acceptance. Existing `/reports/procedures` (doctor bonus) and `/reports/revenue` (paid-fact by hotel code) do not answer this.

## Decision

1. **Screen** `/reports/patient-assignments` (preset `sanatorium_clinical`, same permission as procedure reports). Pick **one patient → one episode**. Default scope is the whole episode (no date filter). Optional filters: room, kind (procedure / lab / visit).
2. **Rows** come from `ProcedureOrder`, `LabOrder`, and `Visit` linked to that episode (package + paid + walk-in on the course).
3. **Assigned** = one per document/line. **Completed** only on full end-state (`ProcedureOrder.COMPLETED`, lab `PUBLISHED`/`COMPLETED`, visit `COMPLETED`). Unpaid, cancelled, `UNPAID_MISSED`, in-progress = not completed.
4. **Amount** only after payment acceptance: procedures need `paymentReceiptRef`; labs/visits need `settledAt`. Package burns (`inPackage`) contribute **0** to the money total but still count as completed when done.
5. **Totals** footer: Σ assigned, Σ completed, Σ amount.
6. **Print** `/print/patient-assignments/[episodeId]` with the same filters; staff page permission `screen:reports.procedures` (same as the report screen).
7. **Room filter options** list every room on the episode (not only the currently filtered subset). Empty visit service lines are **not** treated as package burns.

## Consequences

- API `GET /api/reports/patient-assignments?episodeId=&roomNumber=&kind=`.
- Acceptance stays **SCREEN** until UAT smoke on the report + print.
