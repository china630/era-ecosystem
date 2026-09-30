# Evrostar Wave 10 — Minute buckets in DRAFT

**ADR:** [cp-workforce-floor-attendance.md](../adr/cp-workforce-floor-attendance.md) decisions 3–4  
**Capability:** `CP-WF-MIN-01` (**API**, not SHIPPED)  
**Depends on:** Wave 6 punches, Wave 9 review gate (SUSPICIOUS skipped until Accept)

## Goal

FaceID rebuild classifies presence into minute buckets on the CP timesheet cell. `hours` stays **planned-window normal only** (2 dp). Overtime / night / rest / holiday sit in separate integer columns. Finance mirrors those columns but **does not** feed payroll premiums until wave 11 ([evrostar-wave-11.md](./evrostar-wave-11.md)).

## Break punches

Directions: `BREAK_START` / `BREAK_END` (ingest + CSV). Closed pairs subtract from presence. Open `BREAK_START` alone does **not** write a cell. Floor board shows `OPEN_BREAK` when present.

`ShiftType.breakMinutes` remains the planned break length for shortfall math.

## Buckets on `WorkforceTimesheetEntry`

| Column | Meaning |
|--------|---------|
| `normalMinutes` | Net presence inside planned shift window |
| `shortfallMinutes` | max(0, planned − normal) when the day was a shift |
| `overtimeMinutes` | Net presence outside the window |
| `nightMinutes` | Intersection with 22:00–06:00 Asia/Baku |
| `restDayMinutes` | Net presence on AZ rest day (not holiday) |
| `holidayMinutes` | Net presence on `dayType=holiday` |
| `hourlyLeaveMinutes` | Always 0 this wave |
| `breakMinutes` | Sum of closed break pairs |

Holiday wins over rest. Night may overlap normal/OT. Calendar from data-hub via `CatalogGatewayService.getCalendarDaysRange`; if hub is down, holiday/rest stay 0 and rebuild still writes normal/OT/night/break (warn log).

## Rebuild window source

Shift window for buckets comes from the same roster resolution as the floor board: employment or **brigade** assignment + **day override** (`DAY_OFF` → not a shift day; EXTRA/SWAP can replace the shift type). Calendar holiday/rest still applies on top.

## Approve → Finance

`WORKFORCE_TIMESHEET_APPROVED` rows may include optional `minutes`. Finance writes new `TimesheetEntry` minute columns and keeps `overtimeHours` / `nightHours` / `eveningHours` at **0**.

## UI

`/workspace/workforce/timesheets` shows a read-only minute line under FaceID cells. No six-number editor.

## Evidence

Jest: `attendance-minute-buckets.util.spec.ts`, `workforce-attendance.wave10.spec.ts`, Finance `workforce-timesheet-sync.service.spec.ts` minutes case. COVERAGE `CP-WF-MIN-01` = API until UAT-SMOKE.
