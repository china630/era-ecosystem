-- Wave 2: profit tax, payroll withholding declarations, tax depreciation register, ƏMAS events, fiscal year close

-- TaxDeclarationType: PROFIT_TAX, PAYROLL_WITHHOLDING
ALTER TYPE "TaxDeclarationType" ADD VALUE 'PROFIT_TAX';
ALTER TYPE "TaxDeclarationType" ADD VALUE 'PAYROLL_WITHHOLDING';

-- Profit tax adjustment enums
CREATE TYPE "ProfitTaxAdjustmentKind" AS ENUM ('PERMANENT', 'TEMPORARY');
CREATE TYPE "ProfitTaxAdjustmentSource" AS ENUM ('MANUAL', 'AUTO_TAX_DEPRECIATION');

-- ƏMAS contract event enums
CREATE TYPE "EmasContractEventType" AS ENUM ('HIRE', 'TRANSFER', 'TERMINATE');
CREATE TYPE "EmasContractEventStatus" AS ENUM ('PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'FAILED');

-- Fixed asset tax depreciation profile (NK Art. 114)
CREATE TABLE "fixed_asset_tax_profiles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "fixed_asset_id" UUID NOT NULL,
    "tax_group_code" TEXT NOT NULL,
    "tax_rate_percent" DECIMAL(5,4) NOT NULL,
    "tax_nbv" DECIMAL(19,4) NOT NULL,
    "tax_accumulated" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixed_asset_tax_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fixed_asset_tax_profiles_fixed_asset_id_key" ON "fixed_asset_tax_profiles"("fixed_asset_id");
CREATE INDEX "fixed_asset_tax_profiles_organization_id_idx" ON "fixed_asset_tax_profiles"("organization_id");

ALTER TABLE "fixed_asset_tax_profiles" ADD CONSTRAINT "fixed_asset_tax_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fixed_asset_tax_profiles" ADD CONSTRAINT "fixed_asset_tax_profiles_fixed_asset_id_fkey" FOREIGN KEY ("fixed_asset_id") REFERENCES "fixed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tax depreciation months (parallel to accounting depreciation)
CREATE TABLE "fixed_asset_tax_depreciation_months" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "fixed_asset_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "tax_nbv_after" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fixed_asset_tax_depreciation_months_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fixed_asset_tax_depreciation_months_fixed_asset_id_year_month_key" ON "fixed_asset_tax_depreciation_months"("fixed_asset_id", "year", "month");
CREATE INDEX "fixed_asset_tax_depreciation_months_organization_id_year_month_idx" ON "fixed_asset_tax_depreciation_months"("organization_id", "year", "month");

ALTER TABLE "fixed_asset_tax_depreciation_months" ADD CONSTRAINT "fixed_asset_tax_depreciation_months_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fixed_asset_tax_depreciation_months" ADD CONSTRAINT "fixed_asset_tax_depreciation_months_fixed_asset_id_fkey" FOREIGN KEY ("fixed_asset_id") REFERENCES "fixed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Book-to-tax profit tax adjustments
CREATE TABLE "profit_tax_adjustments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "kind" "ProfitTaxAdjustmentKind" NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "source" "ProfitTaxAdjustmentSource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "profit_tax_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "profit_tax_adjustments_organization_id_year_idx" ON "profit_tax_adjustments"("organization_id", "year");
CREATE INDEX "profit_tax_adjustments_org_deleted_at_idx" ON "profit_tax_adjustments"("organization_id", "deleted_at");

ALTER TABLE "profit_tax_adjustments" ADD CONSTRAINT "profit_tax_adjustments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ƏMAS contract lifecycle events
CREATE TABLE "emas_contract_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "event_type" "EmasContractEventType" NOT NULL,
    "status" "EmasContractEventStatus" NOT NULL DEFAULT 'PENDING',
    "correlation_id" TEXT NOT NULL,
    "emas_external_id" TEXT,
    "payload_json" JSONB NOT NULL,
    "mapping_version" INTEGER NOT NULL DEFAULT 1,
    "error_message" TEXT,
    "submitted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emas_contract_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "emas_contract_events_correlation_id_key" ON "emas_contract_events"("correlation_id");
CREATE INDEX "emas_contract_events_organization_id_employee_id_idx" ON "emas_contract_events"("organization_id", "employee_id");
CREATE INDEX "emas_contract_events_organization_id_status_idx" ON "emas_contract_events"("organization_id", "status");

ALTER TABLE "emas_contract_events" ADD CONSTRAINT "emas_contract_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "emas_contract_events" ADD CONSTRAINT "emas_contract_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fiscal year close (801 → 802 transfer)
CREATE TABLE "fiscal_year_closes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "closed_at" TIMESTAMPTZ(6) NOT NULL,
    "closed_by_user_id" UUID,
    "result_amount" DECIMAL(19,4) NOT NULL,
    "transaction_id" UUID,

    CONSTRAINT "fiscal_year_closes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fiscal_year_closes_organization_id_year_key" ON "fiscal_year_closes"("organization_id", "year");

ALTER TABLE "fiscal_year_closes" ADD CONSTRAINT "fiscal_year_closes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fiscal_year_closes" ADD CONSTRAINT "fiscal_year_closes_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
