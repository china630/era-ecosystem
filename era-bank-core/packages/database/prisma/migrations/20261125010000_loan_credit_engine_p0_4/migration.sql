-- P0-4 loan credit engine depth: accrual, grace, repayment frequency
DO $$ BEGIN
  CREATE TYPE "LoanRepaymentFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'BULLET');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "accrued_interest_minor" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "accrued_penalty_minor" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "last_accrual_date" TIMESTAMP(3);
ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "grace_principal_months" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "grace_interest_months" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "penalty_rate_annual" DOUBLE PRECISION;
ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "first_due_date" TIMESTAMP(3);
ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "apr_percent" DOUBLE PRECISION;

DO $$ BEGIN
  ALTER TABLE "loan_contracts" ADD COLUMN "repayment_frequency" "LoanRepaymentFrequency" NOT NULL DEFAULT 'MONTHLY';
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;