-- Per-type day window + before-lunch lock (4-chamber women AM / men PM)
ALTER TABLE "ProcedureType" ADD COLUMN IF NOT EXISTS "before_lunch_allowed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProcedureType" ADD COLUMN IF NOT EXISTS "day_start_hour" INTEGER;
ALTER TABLE "ProcedureType" ADD COLUMN IF NOT EXISTS "day_end_hour" INTEGER;
