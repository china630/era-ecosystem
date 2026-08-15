-- Follow-up waves: day-count/floating, exception pricing, RWA/CAR, certified ECL params

DO $$ BEGIN ALTER TYPE "DepositStatus" ADD VALUE IF NOT EXISTS 'PENDING_PRICING_APPROVAL'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "LoanStatus" ADD VALUE IF NOT EXISTS 'PENDING_PRICING_APPROVAL'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "EclRunStatus" ADD VALUE IF NOT EXISTS 'PENDING_PROVISION_APPROVAL'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "deposit_contracts" ADD COLUMN IF NOT EXISTS "rate_type" TEXT NOT NULL DEFAULT 'FIXED';
ALTER TABLE "deposit_contracts" ADD COLUMN IF NOT EXISTS "index_key" TEXT;
ALTER TABLE "deposit_contracts" ADD COLUMN IF NOT EXISTS "spread_bps" INTEGER;
ALTER TABLE "deposit_contracts" ADD COLUMN IF NOT EXISTS "next_reset_date" TIMESTAMP(3);
ALTER TABLE "deposit_contracts" ADD COLUMN IF NOT EXISTS "maker_user_id" TEXT;
ALTER TABLE "deposit_contracts" ADD COLUMN IF NOT EXISTS "pricing_exception_reason" TEXT;

ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "rate_annual" DECIMAL(9,6) NOT NULL DEFAULT 0;
ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "day_count_convention" TEXT NOT NULL DEFAULT 'ACT_365';
ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "rate_type" TEXT NOT NULL DEFAULT 'FIXED';
ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "index_key" TEXT;
ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "spread_bps" INTEGER;
ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "next_reset_date" TIMESTAMP(3);
ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "term_months" INTEGER;
ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "maker_user_id" TEXT;
ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "pricing_exception_reason" TEXT;
CREATE INDEX IF NOT EXISTS "loan_contracts_bank_org_id_status_idx" ON "loan_contracts"("bank_org_id", "status");

ALTER TABLE "ecl_calculation_runs" ADD COLUMN IF NOT EXISTS "maker_user_id" TEXT;
ALTER TABLE "ecl_calculation_runs" ADD COLUMN IF NOT EXISTS "checker_user_id" TEXT;
ALTER TABLE "ecl_calculation_runs" ADD COLUMN IF NOT EXISTS "methodology" TEXT NOT NULL DEFAULT 'STAGE_FLAT';

ALTER TABLE "ecl_results" ADD COLUMN IF NOT EXISTS "pd" DOUBLE PRECISION;
ALTER TABLE "ecl_results" ADD COLUMN IF NOT EXISTS "lgd" DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS "rate_index_quotes" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "index_key" TEXT NOT NULL,
    "as_of_date" TIMESTAMP(3) NOT NULL,
    "rate_annual" DECIMAL(9,6) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'STUB',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rate_index_quotes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "rate_index_quotes_bank_org_id_index_key_as_of_date_key" ON "rate_index_quotes"("bank_org_id", "index_key", "as_of_date");
CREATE INDEX IF NOT EXISTS "rate_index_quotes_bank_org_id_index_key_idx" ON "rate_index_quotes"("bank_org_id", "index_key");

CREATE TABLE IF NOT EXISTS "rwa_snapshots" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "as_of_date" TIMESTAMP(3) NOT NULL,
    "total_rwa_minor" BIGINT NOT NULL,
    "credit_rwa_minor" BIGINT NOT NULL DEFAULT 0,
    "details_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rwa_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "rwa_snapshots_bank_org_id_as_of_date_idx" ON "rwa_snapshots"("bank_org_id", "as_of_date");

CREATE TABLE IF NOT EXISTS "capital_adequacy_snapshots" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "as_of_date" TIMESTAMP(3) NOT NULL,
    "tier1_capital_minor" BIGINT NOT NULL,
    "total_capital_minor" BIGINT NOT NULL,
    "rwa_minor" BIGINT NOT NULL,
    "car_ratio" DOUBLE PRECISION NOT NULL,
    "tier1_ratio" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "capital_adequacy_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "capital_adequacy_snapshots_bank_org_id_as_of_date_idx" ON "capital_adequacy_snapshots"("bank_org_id", "as_of_date");

CREATE TABLE IF NOT EXISTS "ecl_parameter_sets" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "as_of_date" TIMESTAMP(3) NOT NULL,
    "params_json" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ecl_parameter_sets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ecl_parameter_sets_bank_org_id_version_key" ON "ecl_parameter_sets"("bank_org_id", "version");
CREATE INDEX IF NOT EXISTS "ecl_parameter_sets_bank_org_id_active_idx" ON "ecl_parameter_sets"("bank_org_id", "active");
