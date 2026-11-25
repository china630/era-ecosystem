-- P0-3 CBAR prudential asset classification & provisions (parallel to ECL)

DO $$ BEGIN
  CREATE TYPE "PrudentialCategory" AS ENUM (
    'QENAETBEXS',
    'NEZARET',
    'ELAVE_RISK',
    'QEYRI_QENAETBEXS',
    'TEHLUKELI',
    'UMIDSIZ'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PrudentialRunStatus" AS ENUM (
    'RUNNING',
    'COMPLETED',
    'FAILED',
    'PENDING_PROVISION_APPROVAL'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "prudential_rate_tables" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "category" "PrudentialCategory" NOT NULL,
    "dpd_min" INTEGER NOT NULL DEFAULT 0,
    "dpd_max" INTEGER,
    "provision_rate" DOUBLE PRECISION NOT NULL,
    "rate_label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "prudential_rate_tables_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "prudential_rate_tables_bank_org_id_category_key"
  ON "prudential_rate_tables"("bank_org_id", "category");
CREATE INDEX IF NOT EXISTS "prudential_rate_tables_bank_org_id_active_idx"
  ON "prudential_rate_tables"("bank_org_id", "active");
CREATE INDEX IF NOT EXISTS "prudential_rate_tables_organization_id_idx"
  ON "prudential_rate_tables"("organization_id");

CREATE TABLE IF NOT EXISTS "prudential_classification_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "as_of_date" TIMESTAMP(3) NOT NULL,
    "status" "PrudentialRunStatus" NOT NULL DEFAULT 'RUNNING',
    "total_outstanding_minor" BIGINT NOT NULL DEFAULT 0,
    "total_provision_minor" BIGINT NOT NULL DEFAULT 0,
    "provision_delta_minor" BIGINT NOT NULL DEFAULT 0,
    "posting_txn_id" TEXT,
    "maker_user_id" TEXT,
    "checker_user_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "prudential_classification_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "prudential_classification_runs_bank_org_id_as_of_date_idx"
  ON "prudential_classification_runs"("bank_org_id", "as_of_date");
CREATE INDEX IF NOT EXISTS "prudential_classification_runs_bank_org_id_status_idx"
  ON "prudential_classification_runs"("bank_org_id", "status");
CREATE INDEX IF NOT EXISTS "prudential_classification_runs_organization_id_idx"
  ON "prudential_classification_runs"("organization_id");

CREATE TABLE IF NOT EXISTS "prudential_classification_results" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "loan_id" TEXT NOT NULL,
    "category" "PrudentialCategory" NOT NULL,
    "dpd" INTEGER NOT NULL,
    "quality_flags" JSONB NOT NULL DEFAULT '[]',
    "rate" DOUBLE PRECISION NOT NULL,
    "provision_minor" BIGINT NOT NULL,
    CONSTRAINT "prudential_classification_results_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "prudential_classification_results_run_id_idx"
  ON "prudential_classification_results"("run_id");
CREATE INDEX IF NOT EXISTS "prudential_classification_results_bank_org_id_loan_id_idx"
  ON "prudential_classification_results"("bank_org_id", "loan_id");
CREATE INDEX IF NOT EXISTS "prudential_classification_results_organization_id_idx"
  ON "prudential_classification_results"("organization_id");

DO $$ BEGIN
  ALTER TABLE "prudential_classification_results"
    ADD CONSTRAINT "prudential_classification_results_run_id_fkey"
    FOREIGN KEY ("run_id") REFERENCES "prudential_classification_runs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;