-- W2: per-block axes + auto-apply state + no-package signal
ALTER TABLE "ProgramTemplateProcedure" ADD COLUMN IF NOT EXISTS "assign_mode" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "ProgramTemplateProcedure" ADD COLUMN IF NOT EXISTS "fulfillment" TEXT NOT NULL DEFAULT 'PROCEDURE_ORDER';
ALTER TABLE "ProgramTemplateProcedure" ADD COLUMN IF NOT EXISTS "quota_basis" TEXT NOT NULL DEFAULT 'PER_NIGHTS';
ALTER TABLE "ProgramTemplateProcedure" ADD COLUMN IF NOT EXISTS "requires_doctor" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ProgramInstance" ADD COLUMN IF NOT EXISTS "auto_apply_state" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "ProgramInstance" ADD COLUMN IF NOT EXISTS "auto_apply_at" TIMESTAMP(3);
ALTER TABLE "ProgramInstance" ADD COLUMN IF NOT EXISTS "auto_apply_note" TEXT;

ALTER TABLE "ClinicalEpisode" ADD COLUMN IF NOT EXISTS "no_package_confirmed_at" TIMESTAMP(3);
ALTER TABLE "ClinicalEpisode" ADD COLUMN IF NOT EXISTS "no_package_confirmed_by_user_id" TEXT;
