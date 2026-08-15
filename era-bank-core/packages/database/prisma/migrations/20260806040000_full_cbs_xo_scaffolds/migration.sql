-- Full CBS Phase 2 XO-1..8 scaffolds (additive)

CREATE TYPE "AtmTerminalStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE "AtmTxnStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'DECLINED', 'SETTLED');
CREATE TYPE "SchemeOutboxStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');
CREATE TYPE "MarketsBookStatus" AS ENUM ('DRAFT', 'BOOKED', 'CANCELLED');
CREATE TYPE "BrokerageOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'FILLED', 'CANCELLED');
CREATE TYPE "CsdAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "MetalPositionStatus" AS ENUM ('ACTIVE', 'CLOSED');
CREATE TYPE "PensionContributionStatus" AS ENUM ('PENDING', 'POSTED');
CREATE TYPE "PsaAccountStatus" AS ENUM ('ACTIVE', 'CLOSED');
CREATE TYPE "AgencyLinkStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "MisReportJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "BpmProcessStatus" AS ENUM ('DRAFT', 'ACTIVE');
CREATE TYPE "DmsDocumentStatus" AS ENUM ('DRAFT', 'ARCHIVED');

CREATE TABLE "atm_terminals" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "location_name" TEXT NOT NULL,
    "status" "AtmTerminalStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "atm_terminals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "atm_terminals_bank_org_id_terminal_id_key" ON "atm_terminals"("bank_org_id", "terminal_id");
CREATE INDEX "atm_terminals_bank_org_id_status_idx" ON "atm_terminals"("bank_org_id", "status");

CREATE TABLE "atm_txns" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "atm_terminal_id" TEXT NOT NULL,
    "card_id" TEXT,
    "amount_minor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "txn_type" TEXT NOT NULL,
    "status" "AtmTxnStatus" NOT NULL DEFAULT 'PENDING',
    "auth_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "atm_txns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "atm_txns_bank_org_id_status_idx" ON "atm_txns"("bank_org_id", "status");
ALTER TABLE "atm_txns" ADD CONSTRAINT "atm_txns_atm_terminal_id_fkey" FOREIGN KEY ("atm_terminal_id") REFERENCES "atm_terminals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "scheme_message_outbox" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "message_type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "status" "SchemeOutboxStatus" NOT NULL DEFAULT 'QUEUED',
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scheme_message_outbox_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "scheme_message_outbox_bank_org_id_status_idx" ON "scheme_message_outbox"("bank_org_id", "status");

CREATE TABLE "derivative_contracts" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "contract_ref" TEXT NOT NULL,
    "product_type" TEXT NOT NULL,
    "notional_minor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "status" "MarketsBookStatus" NOT NULL DEFAULT 'DRAFT',
    "booked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "derivative_contracts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "derivative_contracts_bank_org_id_contract_ref_key" ON "derivative_contracts"("bank_org_id", "contract_ref");
CREATE INDEX "derivative_contracts_bank_org_id_status_idx" ON "derivative_contracts"("bank_org_id", "status");

CREATE TABLE "bond_positions" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "isin" TEXT NOT NULL,
    "face_value_minor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "status" "MarketsBookStatus" NOT NULL DEFAULT 'DRAFT',
    "booked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bond_positions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bond_positions_bank_org_id_isin_idx" ON "bond_positions"("bank_org_id", "isin");

CREATE TABLE "csd_accounts" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "csd_account_no" TEXT NOT NULL,
    "status" "CsdAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "csd_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "csd_accounts_bank_org_id_csd_account_no_key" ON "csd_accounts"("bank_org_id", "csd_account_no");

CREATE TABLE "brokerage_orders" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "isin" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "limit_price_minor" BIGINT,
    "status" "BrokerageOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "brokerage_orders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "brokerage_orders_bank_org_id_customer_id_status_idx" ON "brokerage_orders"("bank_org_id", "customer_id", "status");

CREATE TABLE "metal_positions" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "metal_code" TEXT NOT NULL,
    "weight_grams" DECIMAL(18,6) NOT NULL,
    "status" "MetalPositionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "metal_positions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "metal_positions_bank_org_id_customer_id_idx" ON "metal_positions"("bank_org_id", "customer_id");

CREATE TABLE "pension_contributions" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "employer_ref" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "period_month" TEXT NOT NULL,
    "status" "PensionContributionStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pension_contributions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pension_contributions_bank_org_id_period_month_idx" ON "pension_contributions"("bank_org_id", "period_month");

CREATE TABLE "psa_tsa_accounts" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "agency_code" TEXT NOT NULL,
    "account_no" TEXT NOT NULL,
    "treasury_code" TEXT NOT NULL,
    "status" "PsaAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "psa_tsa_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "psa_tsa_accounts_bank_org_id_account_no_key" ON "psa_tsa_accounts"("bank_org_id", "account_no");

CREATE TABLE "agency_links" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "peer_bank_org_id" TEXT NOT NULL,
    "agency_type" TEXT NOT NULL,
    "status" "AgencyLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agency_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agency_links_bank_org_id_peer_bank_org_id_agency_type_key" ON "agency_links"("bank_org_id", "peer_bank_org_id", "agency_type");

CREATE TABLE "mis_report_jobs" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "report_code" TEXT NOT NULL,
    "params_json" JSONB NOT NULL DEFAULT '{}',
    "status" "MisReportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "result_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "mis_report_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mis_report_jobs_bank_org_id_status_idx" ON "mis_report_jobs"("bank_org_id", "status");

CREATE TABLE "bpm_process_stubs" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "process_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BpmProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "steps_json" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bpm_process_stubs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bpm_process_stubs_bank_org_id_process_code_key" ON "bpm_process_stubs"("bank_org_id", "process_code");

CREATE TABLE "dms_document_meta" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "document_ref" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "DmsDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dms_document_meta_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "dms_document_meta_bank_org_id_document_ref_key" ON "dms_document_meta"("bank_org_id", "document_ref");
