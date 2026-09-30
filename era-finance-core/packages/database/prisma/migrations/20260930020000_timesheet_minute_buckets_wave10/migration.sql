-- Wave 10: CP minute bucket mirror columns (payroll premiums stay on overtimeHours/nightHours)

ALTER TABLE "timesheet_entries"
  ADD COLUMN IF NOT EXISTS "normal_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "shortfall_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "overtime_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "night_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "rest_day_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "holiday_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "hourly_leave_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "break_minutes" INTEGER;
