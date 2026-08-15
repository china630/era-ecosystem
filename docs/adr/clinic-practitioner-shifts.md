# ADR — Clinic practitioner shift rotation (CLI-36)

## Status

Accepted — 2026-07-22.

## Context

Private-clinic doctors rarely work every open day. They rotate shifts (e.g. Mon–Wed
mornings here, other days at another clinic), alternate even/odd weeks, work even/odd
days of the month, or follow multi-week cycles. Before CLI-36 the appointment day
matrix (`getPractitionerDayMatrix`) showed **every active practitioner on every open
day** using tenant-wide working hours, and booking had no per-doctor availability
guard. Reception could book a doctor on a day they are not physically present.

## Decision

Introduce a **rule-based shift engine** rather than a fixed weekly table, so any
recurring pattern the clinic invents is expressible without schema churn.

### Models (`era-clinic/prisma/schema.prisma`)

- `PractitionerScheduleRule` — one recurring availability block:
  - `pattern`: `WEEKLY` | `WEEK_PARITY` | `MONTH_DAY_PARITY` | `CYCLE`.
  - `weekdaysJson` (int[] 0=Sun..6=Sat) for WEEKLY / WEEK_PARITY (optional filter for MONTH_DAY_PARITY).
  - `parity` (`EVEN`|`ODD`) — ISO-week parity for WEEK_PARITY, day-of-month parity for MONTH_DAY_PARITY.
  - `cycleAnchor` + `cycleLengthDays` + `cycleOffsetsJson` — arbitrary N-day rotations (covers "Mon–Wed week 1, Thu–Fri week 2" as a 14-day cycle, or any bespoke rota).
  - `startMinute` / `endMinute` — per-day working window (minutes from midnight, Asia/Baku). **Different hours per day are expressed as separate rules** that stack.
  - `effectiveFrom` / `effectiveTo` — optional seasonal validity.
- `PractitionerScheduleException` — date-specific overrides: `DAY_OFF` (blocks the day), `EXTRA_SHIFT` (adds a window), `CUSTOM_HOURS` (replaces the day's windows).

### Resolution (`practitioner-schedule.service.ts`)

For a given practitioner + Baku calendar day the service returns
`TimeInterval[] | null`:

- `null` = **unrestricted** — the practitioner has no active rules and no exception
  that day, so behaviour is identical to pre-CLI-36 (tenant hours, always available).
  This keeps existing clinics working with zero configuration.
- `[]` = configured but off that day (e.g. `DAY_OFF`, or no matching rule).
- `[{start,end}, …]` = merged, disjoint bookable windows.

Rules are unioned; exceptions applied last (`DAY_OFF` > `CUSTOM_HOURS` replace >
`EXTRA_SHIFT` add). Weekday / day-of-month / ISO-week are derived from the Baku
calendar date via UTC to avoid timezone drift.

### Integration

- **Matrix** (`getPractitionerDayMatrix`): off-shift slots are returned `blocked`
  with `offShift: true`. Per the product decision the doctor's **row stays visible**;
  only the off-shift cells are greyed (like lunch), so reception sees the full roster.
- **Booking guard** (`isWithinShift`): appointment create (`POST /api/appointments`)
  and reschedule (`PATCH /api/appointments/[id]/reschedule`) reject slots outside the
  shift with `409`. Unrestricted practitioners always pass.
- **Admin**: `GET|PUT /api/admin/practitioners/[id]/schedule` (replace-all, audited)
  behind `assertClinicAdminWrite`; edited via **Shifts** modal on `/admin/master-data`.

## Consequences

- Any rotation is data-driven; no code change to add a new clinic's pattern.
- Backward compatible: clinics that never open the Shifts modal are unaffected.
- The engine governs **outpatient appointments**. Sanatorium/procedure resource
  scheduling (CLI-26/30) keeps its own resource-availability model; wiring doctor
  shifts into that board is a possible later wave.
- Legacy slot-list API (`GET /api/scheduling/slots` / `getAvailableSlots`) was
  **removed** — the appointments matrix + booking guard are the only paths.

## Alternatives considered

- **Fixed weekly grid** (7 columns × hours): simplest, but cannot express even/odd
  weeks, month parity, or multi-week rotas — rejected as short-sighted given the
  number of doctors.
- **Cron-materialised per-day availability rows**: more storage + a job to maintain;
  the on-the-fly rule resolver is cheap for a day view and avoids drift.
