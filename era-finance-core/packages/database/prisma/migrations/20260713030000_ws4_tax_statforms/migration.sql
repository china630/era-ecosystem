-- WS4: statutory tax types, profit-tax adjustments, Goskomstat stat form engine

DO $tax_decl_profit$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'TaxDeclarationType' AND e.enumlabel = 'PROFIT_TAX'
  ) THEN
    ALTER TYPE "TaxDeclarationType" ADD VALUE 'PROFIT_TAX';
  END IF;
END
$tax_decl_profit$;

DO $tax_decl_payroll$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'TaxDeclarationType' AND e.enumlabel = 'PAYROLL_WITHHOLDING'
  ) THEN
    ALTER TYPE "TaxDeclarationType" ADD VALUE 'PAYROLL_WITHHOLDING';
  END IF;
END
$tax_decl_payroll$;

DO $tax_decl_property$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'TaxDeclarationType' AND e.enumlabel = 'PROPERTY_TAX'
  ) THEN
    ALTER TYPE "TaxDeclarationType" ADD VALUE 'PROPERTY_TAX';
  END IF;
END
$tax_decl_property$;

DO $profit_kind$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProfitTaxAdjustmentKind') THEN
    CREATE TYPE "ProfitTaxAdjustmentKind" AS ENUM ('PERMANENT', 'TEMPORARY');
  END IF;
END
$profit_kind$;

DO $profit_source$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProfitTaxAdjustmentSource') THEN
    CREATE TYPE "ProfitTaxAdjustmentSource" AS ENUM ('MANUAL', 'AUTO_TAX_DEPRECIATION');
  END IF;
END
$profit_source$;

DO $stat_period$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatReportPeriodKind') THEN
    CREATE TYPE "StatReportPeriodKind" AS ENUM ('YEAR', 'QUARTER', 'MONTH');
  END IF;
END
$stat_period$;

DO $stat_export_status$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatReportExportStatus') THEN
    CREATE TYPE "StatReportExportStatus" AS ENUM ('GENERATED', 'UPLOADED');
  END IF;
END
$stat_export_status$;

CREATE TABLE IF NOT EXISTS "profit_tax_adjustments" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "year" INTEGER NOT NULL,
  "kind" "ProfitTaxAdjustmentKind" NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(19, 4) NOT NULL,
  "source" "ProfitTaxAdjustmentSource" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "profit_tax_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "profit_tax_adjustments_organization_id_year_idx"
  ON "profit_tax_adjustments"("organization_id", "year");
CREATE INDEX IF NOT EXISTS "profit_tax_adjustments_org_deleted_at_idx"
  ON "profit_tax_adjustments"("organization_id", "deleted_at");

DO $profit_org_fk$
BEGIN
  ALTER TABLE "profit_tax_adjustments"
    ADD CONSTRAINT "profit_tax_adjustments_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$profit_org_fk$;

CREATE TABLE IF NOT EXISTS "stat_report_definitions" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "period_kind" "StatReportPeriodKind" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "mapping_json" JSONB NOT NULL DEFAULT '{}',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stat_report_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stat_report_definitions_code_key"
  ON "stat_report_definitions"("code");
CREATE INDEX IF NOT EXISTS "stat_report_definitions_is_active_code_idx"
  ON "stat_report_definitions"("is_active", "code");

CREATE TABLE IF NOT EXISTS "stat_report_exports" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "definition_id" UUID NOT NULL,
  "period" TEXT NOT NULL,
  "status" "StatReportExportStatus" NOT NULL DEFAULT 'GENERATED',
  "file_url" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stat_report_exports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "stat_report_exports_organization_id_definition_id_period_idx"
  ON "stat_report_exports"("organization_id", "definition_id", "period");
CREATE INDEX IF NOT EXISTS "stat_report_exports_organization_id_status_created_at_idx"
  ON "stat_report_exports"("organization_id", "status", "created_at" DESC);

DO $stat_export_org_fk$
BEGIN
  ALTER TABLE "stat_report_exports"
    ADD CONSTRAINT "stat_report_exports_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$stat_export_org_fk$;

DO $stat_export_def_fk$
BEGIN
  ALTER TABLE "stat_report_exports"
    ADD CONSTRAINT "stat_report_exports_definition_id_fkey"
    FOREIGN KEY ("definition_id") REFERENCES "stat_report_definitions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$stat_export_def_fk$;
