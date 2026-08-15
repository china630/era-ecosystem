const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "../prisma/migrations/20260722040000_print_forms");
fs.mkdirSync(dir, { recursive: true });

const sql = `-- Print forms: branding, qualitative analytes, imaging phrases, procedure note/qty

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "print_logo_data_url" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "print_clinic_name_en" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "print_clinic_name_ru" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "print_clinic_name_az" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "print_address_en" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "print_address_ru" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "print_address_az" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "print_phone" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "print_email" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "print_website" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "print_footer_en" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "print_footer_ru" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "print_footer_az" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "print_signature_lab" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "print_signature_doctor" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "checkup_sections_json" TEXT;

DO $$ BEGIN
  CREATE TYPE "AnalyteValueType" AS ENUM ('NUMERIC', 'QUALITATIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "DiagnosticAnalyte" ADD COLUMN IF NOT EXISTS "section" TEXT;
ALTER TABLE "DiagnosticAnalyte" ADD COLUMN IF NOT EXISTS "value_type" "AnalyteValueType" NOT NULL DEFAULT 'NUMERIC';

CREATE TABLE IF NOT EXISTS "AnalyteValueOption" (
  "id" TEXT NOT NULL,
  "analyte_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label_en" TEXT NOT NULL,
  "label_ru" TEXT NOT NULL,
  "label_az" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "AnalyteValueOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AnalyteValueOption_analyte_id_code_key" ON "AnalyteValueOption"("analyte_id", "code");
CREATE INDEX IF NOT EXISTS "AnalyteValueOption_analyte_id_idx" ON "AnalyteValueOption"("analyte_id");

DO $$ BEGIN
  ALTER TABLE "AnalyteValueOption" ADD CONSTRAINT "AnalyteValueOption_analyte_id_fkey"
    FOREIGN KEY ("analyte_id") REFERENCES "DiagnosticAnalyte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ImagingPhrase" (
  "id" TEXT NOT NULL,
  "organ_key" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "text_en" TEXT NOT NULL,
  "text_ru" TEXT NOT NULL,
  "text_az" TEXT NOT NULL,
  "measurement_keys_json" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImagingPhrase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ImagingPhrase_code_key" ON "ImagingPhrase"("code");
CREATE INDEX IF NOT EXISTS "ImagingPhrase_organ_key_sort_order_idx" ON "ImagingPhrase"("organ_key", "sort_order");
CREATE INDEX IF NOT EXISTS "ImagingPhrase_active_idx" ON "ImagingPhrase"("active");

ALTER TABLE "ProcedureOrder" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "ProcedureOrder" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;
`;

fs.writeFileSync(path.join(dir, "migration.sql"), sql, "utf8");
console.log("ok", dir);
