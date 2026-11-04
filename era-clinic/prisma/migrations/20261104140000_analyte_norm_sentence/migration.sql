-- Norm sentence + bound kind + sex-specific numeric pairs for lab analytes.

DO $$ BEGIN
  CREATE TYPE "AnalyteBoundKind" AS ENUM ('INTERVAL', 'UPPER_ONLY', 'LOWER_ONLY', 'QUALITATIVE', 'ZONES');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "DiagnosticAnalyte" ADD COLUMN IF NOT EXISTS "norm_text_en" TEXT;
ALTER TABLE "DiagnosticAnalyte" ADD COLUMN IF NOT EXISTS "norm_text_ru" TEXT;
ALTER TABLE "DiagnosticAnalyte" ADD COLUMN IF NOT EXISTS "norm_text_az" TEXT;
ALTER TABLE "DiagnosticAnalyte" ADD COLUMN IF NOT EXISTS "bound_kind" "AnalyteBoundKind" NOT NULL DEFAULT 'INTERVAL';
ALTER TABLE "DiagnosticAnalyte" ADD COLUMN IF NOT EXISTS "ref_min_female" TEXT;
ALTER TABLE "DiagnosticAnalyte" ADD COLUMN IF NOT EXISTS "ref_max_female" TEXT;
ALTER TABLE "DiagnosticAnalyte" ADD COLUMN IF NOT EXISTS "ref_min_male" TEXT;
ALTER TABLE "DiagnosticAnalyte" ADD COLUMN IF NOT EXISTS "ref_max_male" TEXT;
ALTER TABLE "DiagnosticAnalyte" ADD COLUMN IF NOT EXISTS "zones_json" TEXT;

ALTER TABLE "diagnostic_analyte_template" ADD COLUMN IF NOT EXISTS "norm_text_en" TEXT;
ALTER TABLE "diagnostic_analyte_template" ADD COLUMN IF NOT EXISTS "norm_text_ru" TEXT;
ALTER TABLE "diagnostic_analyte_template" ADD COLUMN IF NOT EXISTS "norm_text_az" TEXT;
ALTER TABLE "diagnostic_analyte_template" ADD COLUMN IF NOT EXISTS "bound_kind" "AnalyteBoundKind" NOT NULL DEFAULT 'INTERVAL';
ALTER TABLE "diagnostic_analyte_template" ADD COLUMN IF NOT EXISTS "ref_min_female" TEXT;
ALTER TABLE "diagnostic_analyte_template" ADD COLUMN IF NOT EXISTS "ref_max_female" TEXT;
ALTER TABLE "diagnostic_analyte_template" ADD COLUMN IF NOT EXISTS "ref_min_male" TEXT;
ALTER TABLE "diagnostic_analyte_template" ADD COLUMN IF NOT EXISTS "ref_max_male" TEXT;
ALTER TABLE "diagnostic_analyte_template" ADD COLUMN IF NOT EXISTS "zones_json" TEXT;

ALTER TABLE "analyte_dictionary" ADD COLUMN IF NOT EXISTS "norm_text_en" TEXT;
ALTER TABLE "analyte_dictionary" ADD COLUMN IF NOT EXISTS "norm_text_ru" TEXT;
ALTER TABLE "analyte_dictionary" ADD COLUMN IF NOT EXISTS "norm_text_az" TEXT;
ALTER TABLE "analyte_dictionary" ADD COLUMN IF NOT EXISTS "bound_kind" "AnalyteBoundKind" NOT NULL DEFAULT 'INTERVAL';
ALTER TABLE "analyte_dictionary" ADD COLUMN IF NOT EXISTS "ref_min_female" TEXT;
ALTER TABLE "analyte_dictionary" ADD COLUMN IF NOT EXISTS "ref_max_female" TEXT;
ALTER TABLE "analyte_dictionary" ADD COLUMN IF NOT EXISTS "ref_min_male" TEXT;
ALTER TABLE "analyte_dictionary" ADD COLUMN IF NOT EXISTS "ref_max_male" TEXT;
ALTER TABLE "analyte_dictionary" ADD COLUMN IF NOT EXISTS "zones_json" TEXT;

ALTER TABLE "LabResult" ADD COLUMN IF NOT EXISTS "norm_text_en" TEXT;
ALTER TABLE "LabResult" ADD COLUMN IF NOT EXISTS "norm_text_ru" TEXT;
ALTER TABLE "LabResult" ADD COLUMN IF NOT EXISTS "norm_text_az" TEXT;
