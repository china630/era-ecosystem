-- Wave 12: paid hourly leave flag on Finance timesheet mirror

ALTER TABLE "timesheet_entries"
  ADD COLUMN IF NOT EXISTS "hourly_leave_paid" BOOLEAN NOT NULL DEFAULT false;
