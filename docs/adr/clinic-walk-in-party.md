# Clinic walk-in party

A walk-in party is a clinic envelope for registering several day visitors at once. It is not a hotel group booking: no rooms, no folio, no `ReservationGroup`.

**Coverage:** CLI-61 · Not SHIPPED / SCREEN.

## Rules

- Entry is `/sanatorium/walk-in-parties`, linked from the sanatorium list next to Register walk-in. Hotel front office does not create the group.
- **UI:** list + `ModalShell` CRUD only (create group, open group, add/edit guest, add service, confirm remove). No full-page create/edit forms. Matches [UI_PLAYBOOK_SATELLITES.md](../UI_PLAYBOOK_SATELLITES.md).
- Each guest row is a real walk-in: `PatientRef` plus an OPEN `ClinicalEpisode` with `patientOrigin = WALK_IN`. The stored placeholder name is `Guest N` until a real name is typed. Placeholder names are not sent to MDM.
- Sex and country are required. Cabin sex still applies to naftalan procedures. This flow does not require package anamnesis or a care-team doctor.
- A procedure is a `ProcedureOrder` (`PENDING_PAY`, `inPackage = false`, `bonusEligible = true`, prescribing doctor on the row). A lab is a `LabOrder`. A visit is a `Visit` with a paid service line. The visit is not a fake procedure, so it stays out of the doctor-bonus report.
- **To cashier** posts one `SettlementPendingCharge` per unpaid line (own SKU and amount). Every line of that send shares `basketRef` = the clinic receipt number. A rejected line does not seat that service and does not remove lines the hotel already accepted.
- Hotel `/front-cash/pending` shows one basket row. Cash or card fiscalizes the basket once and stamps that fiscal id on every charge, then notifies the clinic per `sourceRef`.
- After pay, a procedure uses the existing seat path. A lab (`sourceRef` `lab:{id}`) and a visit are marked paid (`settledAt`) and are not cabin-seated. `SHOW_ON_PLAN` / `HOLD_UNTIL_PAY` still decide whether an unpaid procedure is on the plan.
- The journal is `SatelliteAuditLog` with `entityType = WalkInParty` (create, guest, line, send, hotel paid).

Not SHIPPED. CLI-57 stays SCREEN. Gate, Pilot, and edition unchanged.
