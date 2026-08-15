-- Doctor-confirmed FIFO planning: PROPOSED status, rotation/substitution,
-- extended hours, external labs, peak mode.

CREATE TYPE "RotationScope" AS ENUM ('BODY_PART', 'GROUP');
CREATE TYPE "LabResultSource" AS ENUM ('IN_HOUSE', 'EXTERNAL');

ALTER TYPE "ProcedureOrderStatus" ADD VALUE IF NOT EXISTS 'PROPOSED' BEFORE 'SCHEDULED';

ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "peak_mode_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "peak_day_end_hour" INTEGER NOT NULL DEFAULT 22;

ALTER TABLE "Resource"
  ADD COLUMN IF NOT EXISTS "extended_end_hour" INTEGER;

ALTER TABLE "ProcedureType"
  ADD COLUMN IF NOT EXISTS "extended_end_hour" INTEGER;

ALTER TABLE "ProcedureOrder"
  ADD COLUMN IF NOT EXISTS "confirmed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "confirmed_by_user_id" TEXT;

ALTER TABLE "LabOrder"
  ADD COLUMN IF NOT EXISTS "source" "LabResultSource" NOT NULL DEFAULT 'IN_HOUSE',
  ADD COLUMN IF NOT EXISTS "result_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "fasting" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "scheduled_collection_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "ProcedureRotationRule" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "member_codes" TEXT[],
  "scope" "RotationScope" NOT NULL DEFAULT 'GROUP',
  "max_consecutive_days" INTEGER NOT NULL DEFAULT 1,
  "rest_procedure_code" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcedureRotationRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProcedureRotationRule_code_key" ON "ProcedureRotationRule"("code");
CREATE INDEX IF NOT EXISTS "ProcedureRotationRule_active_idx" ON "ProcedureRotationRule"("active");

CREATE TABLE IF NOT EXISTS "ProcedureSubstitutionRule" (
  "id" TEXT NOT NULL,
  "original_code" TEXT NOT NULL,
  "substitute_code" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcedureSubstitutionRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProcedureSubstitutionRule_original_code_idx" ON "ProcedureSubstitutionRule"("original_code");
CREATE INDEX IF NOT EXISTS "ProcedureSubstitutionRule_substitute_code_idx" ON "ProcedureSubstitutionRule"("substitute_code");
CREATE INDEX IF NOT EXISTS "ProcedureSubstitutionRule_active_idx" ON "ProcedureSubstitutionRule"("active");
