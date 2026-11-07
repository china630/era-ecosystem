-- FIXED vs DAILY_RATE package quotas: mode + Sunday flag + per-night / daily-use fields.
ALTER TABLE "ProgramTemplate" ADD COLUMN "quota_mode" TEXT NOT NULL DEFAULT 'FIXED';
ALTER TABLE "ProgramTemplate" ADD COLUMN "count_sunday" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ProgramTemplateProcedure" ADD COLUMN "quota_per_night" INTEGER;
ALTER TABLE "ProgramTemplateProcedure" ADD COLUMN "daily_use_cap" INTEGER;
