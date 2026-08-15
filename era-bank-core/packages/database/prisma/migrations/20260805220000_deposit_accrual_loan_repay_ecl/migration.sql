-- Deposit contract rate lock + accrual audit
ALTER TABLE "deposit_contracts" ADD COLUMN IF NOT EXISTS "rate_annual" DECIMAL(9,6) NOT NULL DEFAULT 0;
ALTER TABLE "deposit_contracts" ADD COLUMN IF NOT EXISTS "day_count_convention" TEXT NOT NULL DEFAULT 'ACT_365';
ALTER TABLE "deposit_contracts" ADD COLUMN IF NOT EXISTS "last_accrual_date" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "deposit_contracts_bank_org_id_status_idx" ON "deposit_contracts"("bank_org_id", "status");

-- Loan installment partial payment tracking
ALTER TABLE "loan_schedule_installments" ADD COLUMN IF NOT EXISTS "paid_principal_minor" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "loan_schedule_installments" ADD COLUMN IF NOT EXISTS "paid_interest_minor" BIGINT NOT NULL DEFAULT 0;

-- ECL MVP tables
DO $$ BEGIN
  CREATE TYPE "EclRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ecl_calculation_runs" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "as_of_date" TIMESTAMP(3) NOT NULL,
    "status" "EclRunStatus" NOT NULL DEFAULT 'RUNNING',
    "total_ead_minor" BIGINT NOT NULL DEFAULT 0,
    "total_ecl_minor" BIGINT NOT NULL DEFAULT 0,
    "provision_delta_minor" BIGINT NOT NULL DEFAULT 0,
    "posting_txn_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "ecl_calculation_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ecl_results" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "loan_id" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "ead_minor" BIGINT NOT NULL,
    "ecl_minor" BIGINT NOT NULL,
    "stage_rate" DOUBLE PRECISION NOT NULL,
    "collateral_minor" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "ecl_results_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ecl_calculation_runs_bank_org_id_as_of_date_idx" ON "ecl_calculation_runs"("bank_org_id", "as_of_date");
CREATE INDEX IF NOT EXISTS "ecl_calculation_runs_bank_org_id_status_idx" ON "ecl_calculation_runs"("bank_org_id", "status");
CREATE INDEX IF NOT EXISTS "ecl_results_run_id_idx" ON "ecl_results"("run_id");
CREATE INDEX IF NOT EXISTS "ecl_results_bank_org_id_loan_id_idx" ON "ecl_results"("bank_org_id", "loan_id");

DO $$ BEGIN
  ALTER TABLE "ecl_results" ADD CONSTRAINT "ecl_results_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "ecl_calculation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
