-- FC-2…FC-7 product depth migration

CREATE TYPE "ForbearanceStage" AS ENUM ('NONE', 'WATCH', 'PAYMENT_HOLIDAY', 'TERM_EXTENSION', 'RESTRUCTURE');
CREATE TYPE "ScfProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'FUNDED', 'CLOSED');

ALTER TABLE "deposit_contracts" ADD COLUMN "index_link_key" TEXT;
ALTER TABLE "deposit_contracts" ADD COLUMN "call_notice_days" INTEGER;

ALTER TABLE "loan_contracts" ADD COLUMN "asset_ref" TEXT;
ALTER TABLE "loan_contracts" ADD COLUMN "invoice_ref" TEXT;
ALTER TABLE "loan_contracts" ADD COLUMN "trade_ref" TEXT;
ALTER TABLE "loan_contracts" ADD COLUMN "project_ref" TEXT;
ALTER TABLE "loan_contracts" ADD COLUMN "participation_pct" DECIMAL(7,4);
ALTER TABLE "loan_contracts" ADD COLUMN "lead_bank_name" TEXT;

ALTER TABLE "loan_applications" ADD COLUMN "forbearance_stage" "ForbearanceStage" NOT NULL DEFAULT 'NONE';

CREATE TABLE "credit_policy_rules" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rules_json" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "credit_policy_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "credit_policy_rules_bank_org_id_code_key" ON "credit_policy_rules"("bank_org_id", "code");
CREATE INDEX "credit_policy_rules_bank_org_id_enabled_idx" ON "credit_policy_rules"("bank_org_id", "enabled");

ALTER TABLE "inventory_movements" ADD COLUMN "journal_txn_id" TEXT;

ALTER TABLE "branch_queue_tickets" ADD COLUMN "assignee_user_id" TEXT;
ALTER TABLE "branch_queue_tickets" ADD COLUMN "crm_notes" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "scf_programs" ADD COLUMN "status" "ScfProgramStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "scf_programs" ADD COLUMN "funded_minor" BIGINT NOT NULL DEFAULT 0;

CREATE TABLE "money_market_placements" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "counterparty_id" TEXT NOT NULL,
    "nostro_account_id" TEXT NOT NULL,
    "principal_minor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "rate_annual" DECIMAL(9,6) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "maturity_date" TIMESTAMP(3) NOT NULL,
    "book_gl_code" TEXT NOT NULL,
    "status" "PlacementStatus" NOT NULL DEFAULT 'ACTIVE',
    "open_posting_txn_id" TEXT,
    "close_posting_txn_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "money_market_placements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "money_market_placements_idempotency_key_key" ON "money_market_placements"("idempotency_key");
CREATE INDEX "money_market_placements_bank_org_id_status_idx" ON "money_market_placements"("bank_org_id", "status");

CREATE TABLE "acquiring_merchants" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "merchant_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mcc" TEXT,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "auth_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "acquiring_merchants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "acquiring_merchants_bank_org_id_merchant_code_key" ON "acquiring_merchants"("bank_org_id", "merchant_code");

ALTER TABLE "safekeeping_accounts" ADD COLUMN "csd_account_no" TEXT;

CREATE TABLE "custody_position_ledger" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "custody_position_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "reference" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "custody_position_ledger_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "custody_position_ledger_bank_org_id_custody_position_id_idx" ON "custody_position_ledger"("bank_org_id", "custody_position_id");
ALTER TABLE "custody_position_ledger" ADD CONSTRAINT "custody_position_ledger_custody_position_id_fkey" FOREIGN KEY ("custody_position_id") REFERENCES "custody_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "insurance_products" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partner_name" TEXT NOT NULL,
    "commission_bps" INTEGER NOT NULL DEFAULT 0,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "insurance_products_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "insurance_products_bank_org_id_code_key" ON "insurance_products"("bank_org_id", "code");

CREATE TABLE "insurance_policy_links" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "insurance_product_id" TEXT NOT NULL,
    "policy_ref" TEXT NOT NULL,
    "premium_minor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "insurance_policy_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "insurance_policy_links_bank_org_id_policy_ref_key" ON "insurance_policy_links"("bank_org_id", "policy_ref");
CREATE INDEX "insurance_policy_links_bank_org_id_customer_id_idx" ON "insurance_policy_links"("bank_org_id", "customer_id");
ALTER TABLE "insurance_policy_links" ADD CONSTRAINT "insurance_policy_links_insurance_product_id_fkey" FOREIGN KEY ("insurance_product_id") REFERENCES "insurance_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "aml_cases" ADD COLUMN "sar_draft_fields" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "fraud_score_requests" ADD COLUMN "device_id" TEXT;
ALTER TABLE "fraud_score_requests" ADD COLUMN "mule_suspect_flag" BOOLEAN NOT NULL DEFAULT false;
