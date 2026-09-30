# Evrostar Wave 11 — Finance prices minute buckets

**ADR:** [cp-workforce-floor-attendance.md](../adr/cp-workforce-floor-attendance.md) decisions 4 and 8  
**Capability:** `FIN-HR-MIN-01` (**API**, not SHIPPED)  
**Depends on:** Wave 10 minute mirror on Finance `TimesheetEntry`

## Goal

When an approved CP timesheet carried `minutes`, Finance DRAFT payroll (`hr_full`) prices those columns with the existing hourly premium formula. Control plane still does not compute gross, DSMF, or net.

## Pricing rules

| Bucket | Slip code | Rate |
|--------|-----------|------|
| `overtimeMinutes` | `OVERTIME_PREMIUM` | `max(schedule.overtimePremiumRate, 2)` (TK AR art. 165) |
| `nightMinutes` | `NIGHT_PREMIUM` | `schedule.nightPremiumRate` (no ×2 floor) |
| `holidayMinutes` | `HOLIDAY_PREMIUM` | `max(schedule.holidayPremiumRate, 2)` |
| `restDayMinutes` | `REST_PREMIUM` | `max(schedule.restPremiumRate, 2)` |
| `shortfallMinutes` + `hourlyLeaveMinutes` | `UNPAID_TIME` (deduction line) | hourly × unpaid hours; **WORK days only**; skip `lockedFromAbsence`; **subtracted from taxable gross** before PIT/DSMF (not a post-tax hold like alimony) |

Formula for premiums: `hourly × hours × (rate − 1)`, where `hourly = grossBase / (dayHours × normWorkingDays)`.

Holiday / rest premiums are **add-ons** (do not reduce base salary). Zero amounts are not written to the slip.

## Legacy vs CP minutes

- If any minute column is non-null for the employee → **minutes path**; ignore `overtimeHours` / `nightHours` / `eveningHours`.
- If all minute columns are null → legacy hour fields (Finance-master timesheet without Workforce Hub).

## MGMT / NAS (unchanged)

- MGMT labor delta still uses sum of `TimesheetEntry.hours` (normal window), not overtime minutes.
- Registry pay posts to the operational NAS book. No new pay-document types (alimony / loan / advance / material aid stay manual lines).

## Schedule rates

`WorkSchedule` gains `holidayPremiumRate` and `restPremiumRate` (default 2). Create/update floors OT / holiday / rest at 2. Night default 1.5 is unchanged.

## Evidence

Jest: `payroll-minute-premiums.spec.ts`. COVERAGE `FIN-HR-MIN-01` = API until UAT-SMOKE. Product Readiness payroll stays 🟡.
