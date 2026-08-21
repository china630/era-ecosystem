# ADR: Clinic staff kind + monthly duty roster (CLI-38)

## Status

Accepted — 2026-08-17

Related: [clinic-multi-resource-scheduling.md](./clinic-multi-resource-scheduling.md) · [clinic-practitioner-shifts.md](./clinic-practitioner-shifts.md) · [clinic-procedure-day-ops.md](./clinic-procedure-day-ops.md)

## Context

Nafta posts a paper form *«Tibb bacılarının fizioterapevtik aparatarda işləmə qrafiki»*: at the start of each month the head doctor assigns nurses to physiotherapy devices. One nurse may cover several devices; some assignments stay stable; vacations and other absences must be visible. Laboratory staff is a third class, not a doctor and not a procedure nurse.

The satellite already had:

- one `Practitioner` list (no doctor / nurse / lab split);
- `PractitionerSkill` = lasting capability;
- CLI-36 shifts = *when* a person works;
- CLI-31 `ProcedureRotationRule` = *patient* treatment rotation (naftalan → iod-brom), not staff posting.

None of those is the monthly duty matrix.

## Decision

1. **`Practitioner.staffKind`** = `DOCTOR | NURSE | LAB`. Hire from CP Workforce maps `satelliteRole` (`LAB_TECH` → `LAB`). SatAdmin may correct kind. Appointment day matrix lists **doctors only**.
2. **`StaffDutyRoster` + `StaffDutyLine`** — one approved (or draft) matrix per org / `YYYY-MM` / staff kind. Rows = procedure types; cell = one practitioner. `stable` copies into next month's draft. Opening a new month seeds from the previous month.
3. **Screen** lives under Sanatorium: `/sanatorium/nurse-roster` (DOCTOR + SatAdmin). Monthly ops for the head doctor, not a catalog. Toggle Nurses / Lab staff on the same page. Link from `/admin/master-data`.
4. **Planner** (`findSkilledFreePractitioner`): when the month roster is **APPROVED**, assign the posted nurse. If they are absent that day, fall back to other skilled nurses. Draft / missing roster keeps the skilled NURSE pool (back-compat).
5. **`StaffAbsence`** (vacation / sick / training / other) is a clinic-local overlay. CLI-36 `DAY_OFF` exceptions also warn on the matrix. Finance HR vacation sync is **out of this wave**.

## Explicitly not in this wave

- Reading Finance HR approved vacations.
- Multi-nurse cells on one procedure row (paper is 1:1).
- Applying CLI-36 shifts to the sanatorium resource matrix (still open).
- A separate lab-analyzer posting board beyond the same monthly matrix with `staffKind=LAB`.

## Consequences

- Head doctor approves the month; FIFO placement and `/nurse?mine=1` follow the posting.
- Skills remain the capability check (UI warns if posted without skill; override allowed).
- Login role `LAB_TECH` is wired; lab-orders nav includes it.
