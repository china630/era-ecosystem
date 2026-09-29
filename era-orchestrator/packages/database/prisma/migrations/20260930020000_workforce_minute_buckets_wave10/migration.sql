-- Evrostar Wave 10: break punch directions + timesheet minute buckets

DO $$ BEGIN
  ALTER TYPE "WorkforceAttendanceDirection" ADD VALUE 'BREAK_START';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "WorkforceAttendanceDirection" ADD VALUE 'BREAK_END';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "workforce_timesheet_entries"
  ADD COLUMN IF NOT EXISTS "normal_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "shortfall_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "overtime_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "night_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "rest_day_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "holiday_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "hourly_leave_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "break_minutes" INTEGER;
