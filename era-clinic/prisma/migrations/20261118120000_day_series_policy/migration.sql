-- Day series rhythm policy on ProcedureDaySeries
ALTER TABLE "procedure_day_series" ADD COLUMN IF NOT EXISTS "mode_code" TEXT;
ALTER TABLE "procedure_day_series" ADD COLUMN IF NOT EXISTS "weekly_cap" INTEGER;
ALTER TABLE "procedure_day_series" ADD COLUMN IF NOT EXISTS "afternoon_pin_retry" BOOLEAN NOT NULL DEFAULT true;
