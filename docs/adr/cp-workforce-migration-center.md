# ADR: Workforce migration center (Evrostar pack)

- **Status:** Accepted (implementation landed; not SHIPPED)
- **Date:** 2026-09-24
- **Implementation:** landed 2026-09-24 — API + SCREEN (`/workspace/workforce/migration`). Not SHIPPED / not `ga`.
- **Product:** Control plane Workforce (`era-orchestrator`) + Finance salary step + MDM identity
- **Capability:** CP-WF-MIG-01 (new). Does **not** replace CP-WF-IMP-01.
- **Amends:** [evrostar-workforce-pilot.md](./evrostar-workforce-pilot.md)
- **Related:** [cp-workforce-brigade-membership.md](./cp-workforce-brigade-membership.md), [cp-personnel-orders.md](./cp-personnel-orders.md), [cp-workforce-absence-split.md](./cp-workforce-absence-split.md), [workforce-dual-audit.md](./workforce-dual-audit.md), [asia-baku-clock.md](./asia-baku-clock.md), [finance-accounting-book.md](./finance-accounting-book.md)

HR for Evrostar and Evrostar Group keeps people, leave orders, and vacation balances in Excel. A prepared pack (one folder per legal entity) is the load source. The generic importer (`POST /platform/v1/workforce/import/roster|absences|org-structure`, CP-WF-IMP-01) does not match that pack: it hires by FIN into an existing unit, posts absences by `staffCode` through the live submit path, and has no brigade, place, balance, or salary steps. Clinic cutover (`era-clinic` `/admin/import`) is the UX pattern: numbered steps, preview, apply, idempotent re-apply, warning when a prior step is unfinished.

This ADR is the wizard. It is not SHIPPED and not edition `ga`.

## Context (pack)

Source files live outside the repo (`EMPLOYEES/workforce-import/<COMPANY>/`). Two companies, two runs. Same eight files:

| File | Role |
|------|------|
| `02_org_structure.csv` | Org unit + position + `totalSlots`. Evrostar uses two units (management vs worker group). A/B/C qr are **brigades**, not units. Sites are **places**. |
| `01_roster.csv` | Person card: FIN, name, sex, birth, SSN, unit, position, brigade, place, hire date, schedule, `importReady` |
| `03_leave_history.csv` | One row per leave order (`VACATION`, `COMPENSATION`, `OTHER`) |
| `04_vacation_balance.csv` | Closing balance. Every row `replayHistoryIntoBalance=no` |
| `05_salary.csv` | Official contract amount (400 AZN) and Face Kontrol take-home / `internalRate` |
| `06_used_by_year.csv` | Year grid that already matches `usedDays`. Evidence, not movements |
| `07_needs_review.csv` | HR exception queue. Not a load file |
| `08_terminated.csv` | People who left. **Out of this load** |

`importReady=no` rows stay out until HR fills the card and the pack is rebuilt. Terminated rows in any file stay out. A FIN that already belongs to a person in the other company must resolve that MDM person, not create a second natural person. Employment itself stays in the JWT organization.

## Decision

### 1. One wizard per organization

The operator runs the wizard under the organization JWT (switch company, run again). No cross-org write and no merged tree.

UX follows the clinic wizard: phases, preview, apply, re-apply, progress stored for that org. A prior step that is neither applied nor skipped shows a warning. It does not hard-lock the next step.

**Skip step** is an explicit operator action (“this company does not use this”), stored like a completed step. Skip is for a whole step, not for a bad row. Bad rows error in the preview and are not written.

Proposed screen: `/workspace/workforce/migration`. i18n en + az + ru. Kit controls. Not SHIPPED until UAT.

### 2. Steps

| # | Step | Source | Required? | Writes |
|---|------|--------|-----------|--------|
| 1 | Org structure | `02` | Required | Org units + positions. Match names case-insensitively; fix duplicate labels in the pack before apply (`Nəzarətçi` / `nəzarətçi`) |
| 2 | Places | distinct `place` on ready roster rows | Skippable | `WorkforcePlace`. Empty place does not invent a site |
| 3 | People | `01` where `importReady=yes`, `employmentStatus=ACTIVE`, 7-char FIN, position, hire date | Required | MDM resolve + CP employment, **no satellite keys** (headcount, no seat). No salary on this step |
| 4 | Brigades | `brigade` on those people | Skippable | Dated membership ([cp-workforce-brigade-membership.md](./cp-workforce-brigade-membership.md)), `effectiveFrom` = hire date (Baku). Empty brigade skips the **row** |
| 5 | Shift assignment | schedule / place columns | Skippable | Place × cycle assignment. Skip when the company is not running the roster yet |
| 6 | Vacation balance | `04` active rows with FIN | Skippable | One opening figure `balanceDays` at `asOfDate`. History does not move it |
| 7 | Leave history | `03` active + FIN + `kind=VACATION` | Skippable, **on for Evrostar** | See §4. This is how HR leaves Excel |
| 8 | Salary | `05` | Skippable | Finance only, after employment exists. See §6 |
| 9 | Year grid | `06` | Skip by default | No write. Optional later reconcile report |

`07` is the gate in front of step 3, not a step. `08` and any `TERMINATED` row are not steps.

A 5-character FIN (foreign director) stays in the review queue until a passport identity path is used. Do not relax the 7-character FIN check inside step 3 to force that row through.

### 3. Origin is a field, not a lifecycle status

Imported rows are **already decided**. Later manual work still goes through submit and approve.

| Record | Lifecycle on import | Later manual path |
|--------|---------------------|-------------------|
| Absence | `APPROVED` | `DRAFT` → `SUBMITTED` → `APPROVED` |
| Personnel order | `ISSUED` | `DRAFT` → `ISSUED` |

`APPROVED` and `ISSUED` are not two rungs of one ladder. Absence `APPROVED` is the operational fact (these days off). Order `ISSUED` is the legal act (number, date, frozen text). See [cp-personnel-orders.md](./cp-personnel-orders.md).

Do **not** add a status `IMPORTED`. Both imported history and a leave approved next month are `APPROVED`. Lists cannot tell them apart by status.

Add on `WorkforceAbsence` and `WorkforcePersonnelOrder`:

| Field | Rule |
|-------|------|
| `source` | `manual` (default) or `import` |
| `sourceRef` | Idempotency key: FIN + order number + start/end (or the pack row key). Not PII beyond what the order already stores |

Same idea as timesheet `source` / `sourceRef` and clinic `importedHistorical`. Code branches on `source` (do not replay balance, do not lock a closed timesheet month). The audit log does not.

### 4. Leave history

Step 7 writes, for each active `VACATION` row with a FIN that matches an employment in this org:

- `WorkforceAbsence`: `kind=VACATION`, `status=APPROVED`, `source=import`, dates from the file, note keeps the Excel order number and order date.
- `WorkforcePersonnelOrder`: `type=LEAVE_ANNUAL`, `status=ISSUED`, `source=import`, **printed number = Excel `orderNo`**. Do not consume the live per-year sequence (`Ə-Q-…`).

Does **not**:

- Call the submit/approve API.
- Publish `WORKFORCE_ABSENCE_APPROVED` ([cp-workforce-absence-split.md](./cp-workforce-absence-split.md)). Finance must not mirror these rows into payroll.
- Subtract days from the step 6 balance (`replayHistoryIntoBalance=no`).
- Set `lockedFromAbsence` on timesheet months that are already `APPROVED`. Open DRAFT months are unchanged by this load. The shift plan is not copied into those cells.

`COMPENSATION` and `OTHER` are not absences. They do not become calendar days off. They may be stored later as issued orders with `source=import`, or skipped. Evrostar step 7 loads `VACATION` only.

Re-apply matches `sourceRef` and updates dates in place. It does not insert a second row.

### 5. Vacation balance

Step 6 stores the closing balance as an opening figure on the employment (or the Finance vacation balance once `financeEmployeeId` exists), stamped with `asOfDate` and `source=import`. Applying step 7 before or after step 6 must not change that figure. The year grid (`06`) is how the pack was checked; it is not a second ledger.

### 6. Salary

Not on CP hire. When step 8 runs:

- `salary` (official 400 AZN) → Finance contract / NAS.
- `internalRate` (and the take-home column as the rate source, not as a second payroll) → MGMT only, per [evrostar-workforce-pilot.md](./evrostar-workforce-pilot.md). No MGMT cash payment, no DSMF file.

Skipping step 8 leaves people in the system with no rate. That is allowed.

### 7. Audit

Each apply writes one `WorkforceAuditLog` row `WORKFORCE_IMPORT_APPLIED`: organization, actor, step id, created / updated / skipped / errors. Payload is counts and step id, not a person list and not the way UI filters “imported”.

Skip-step writes the same action with `outcome=skipped` so the wizard can show the step as done for this org.

### 8. Idempotency

Natural key per organization and step (`sourceRef`). Preview returns row-level created / updated / skipped / error and writes nothing. Apply is repeatable. Case-only renames of positions are fixed in the pack, not by creating two positions.

## Non-goals

- Loading terminated people or their leave (`08`, `employmentStatus=TERMINATED`).
- Replacing CP-WF-IMP-01 (small CSV hire / absence / org file).
- FaceID device identities, ƏMAS submit, staffing optimizer.
- Replaying `06` as balance movements.
- Emitting Finance absence or payroll events from historical leave.
- Edition `ga` or SHIPPED from this ADR.

## Consequences

- Schema: `source` + `sourceRef` on absence and personnel order; opening vacation balance stamp; wizard step state per organization (applied / skipped + last summary).
- New UI route when implemented; module map updated in that change.
- CP-WF-IMP-01 stays the generic importer. CP-WF-MIG-01 is **API** + UI **SCREEN** until UAT. Not SHIPPED from this document.
- COVERAGE changelog records implementation as API/SCREEN.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Stretch CP-WF-IMP-01 to accept the eight files | One endpoint would hide step order, skips, and the “do not replay balance” rule |
| Import leave as `SUBMITTED` so HR approves hundreds of old orders | They already happened. The point of the load is to leave Excel |
| Status `IMPORTED` instead of `APPROVED` / `ISSUED` | Breaks every filter and the meaning of “already decided” |
| Audit log as the only origin mark | Lists, timesheet, and balance code cannot branch on a batch log row |
| Load terminated history “for the archive” | No FIN on those rows; HR said current staff only |
