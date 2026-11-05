ALTER TABLE "DiagnosticService" ADD COLUMN IF NOT EXISTS "auto_paid_on_open" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "auto_paid_stay" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ClinicalEpisode" ADD COLUMN IF NOT EXISTS "auto_paid_lab_misses" TEXT;
