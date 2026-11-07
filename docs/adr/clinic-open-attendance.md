# ADR: Clinic open attendance + same-day check-in window

## Status

Accepted — 2026-10-28 (CLI-62)

Related: [clinic-procedure-day-ops.md](./clinic-procedure-day-ops.md) · [clinic-scheduling-time-layers.md](./clinic-scheduling-time-layers.md) · [clinic-extra-procedure-route.md](./clinic-extra-procedure-route.md) · [clinic-hotel-capacity-foresight.md](./clinic-hotel-capacity-foresight.md)

## Context

Some package procedures (inhalation, ozone, gym) use the same quotas and package rules as timed rows, but guests arrive when free — not at a rigid clock. Separately, during cutover from a weak legacy planner, nurses need a temporary **same-day** check-in window so live-queue habits still work for already-seated timed rows.

We must not invent a new registration door. Package assign, extras/Pay, nurse check-in, plan/print, and the resource matrix stay the only surfaces.

## Decision

### Open attendance (`schedulingMode = OPEN`)

| Layer | Rule |
|-------|------|
| Catalog | `ProcedureType.openAttendance` (SatAdmin checkbox). Copy onto `ProcedureOrder.schedulingMode` (`FIXED` \| `OPEN`) at create. |
| Assign | Saxla / adjust create day-bucket `SCHEDULED` rows: calendar day pinned, `resourceId = null`, **no** `ResourceBooking` / cabin scan. Different codes share a working day; the same code is once per day and then the next working day, through stay `endsOn`. An in-package row also obeys its block distinct-code cap; a paid extra does not. A row that does not fit is `no_slot` (unpaid extra is deleted, not left on the prescribe clock). `prescribeExtras` under `PLAN_BEFORE_PAY` pins OPEN unpaid the same way (then status back to `PENDING_PAY`). A later Saxla that adds or removes those extras drops unpaid rows from the latest day and reseats the remaining OPEN `PENDING_PAY` of the touched codes from today. Pay **keeps** that day pin (does not re-walk from today). Baths and HARD-staff types should keep the flag off in pilot. |
| Clock storage | `scheduledAt` is **civil-day anchor only** (often `dayStartHour` stamp). It is **not** an appointment clock. UI hides the time until seated. Planners must use `orderCountsForWallClockRest` (`countsForRest`) — OPEN unseated must **not** enter FIXED `restGap`, mutual-exclusion / sequence-gap overlap, or compatibility checks (a day-start stamp must never block a bath or paid extra that same Baku day). Same-day / package-cap still see the row. |
| Quota | OPEN burns entitlement only on `CHECKED_IN` / `COMPLETED`. Day-bucket `SCHEDULED` does **not** burn. Auto `NO_SHOW` sweep **skips** OPEN. |
| Plan / print | Sort OPEN unseated **first** within the civil day (before timed rows); time label = open-attendance (not wall clock) until seated. |
| Matrix | No timed bar until seated. Unseated OPEN is a queue band on that procedure's cabins: morning and afternoon, waiting shared, arrivals split at lunch. The first cabin of the procedure shows the full counts; the other cabins show the procedure name, the half (before or after lunch), and the waiting count. Nurse board does not duplicate the bands. |
| Nurse | Check-in window = clinic working hours that Baku day. Check-in **seats** a free matching cabin (`endsAt = now + duration`), then normal `CHECKED_IN` → auto-complete. Reception may use the same window from the resource matrix when `receptionProcedureCheckIn` is on. |
| Canon seat door | Nurse check-in. Matrix may show the bar after seat; DnD of unseated OPEN is refused (or explicit “pin FIXED” later). |

Not the same as `PatientOrigin.WALK_IN`, walk-in party (CLI-61), `PROPOSED`, or `HOLD_UNTIL_PAY` unseated extras.

### Same-day check-in window (transition)

| Field | Meaning |
|-------|---------|
| `Tenant.procedureCheckInWindow` | `STRICT` (default) \| `SAME_DAY` |
| `Tenant.procedureCheckInSameDayUntil` | Optional Asia/Baku calendar end date; after that day STRICT applies even if mode is SAME_DAY |

When SAME_DAY is active for today:

- Timed (`FIXED`) `SCHEDULED` rows may check in any time during clinic open hours that day (not only `scheduledAt ± grace`).
- On check-in: **rebase occupancy** to `[now, now+duration)` on the same cabin (keep `scheduledAt` as the plan clock; set `checkedInAt` / `endsAt` / bookings). Cabin must be free **now**.
- Do not invent a second “actual check-in time” column — use existing `checkedInAt`.
- Mid-day `autoNoShowAfterMin` from the planned slot is skipped while SAME_DAY is active for that day; EOD sweep after `dayEndHour` still applies to FIXED.

### Open foresight (not CLI-27)

Ops signal only: for a Baku day, count OPEN `SCHEDULED` unseated (`waiting`), OPEN `CHECKED_IN` (`inCabin`), and arrivals before vs after lunch (`checkedInAt`, including `COMPLETED`). Drawn as two bands on the resource calendar cabins of that procedure. Nurse board does not duplicate them. Does **not** block hotel booking (CLI-27 remains slot inventory).

## Consequences

- Zero new procedure registration screens.
- CLI-26 day-ops notes OPEN / SAME_DAY branches; SHIPPED claims wait on UAT-SMOKE for CLI-62.
- Pilot: soft SKUs only until HARD staff / bath open policy is proven.
