-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "GlAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE', 'OFF_BALANCE');

-- CreateEnum
CREATE TYPE "BranchStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('NATURAL', 'LEGAL');

-- CreateEnum
CREATE TYPE "RiskRating" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'REVIEW');

-- CreateEnum
CREATE TYPE "TrustTier" AS ENUM ('SELF_DECLARED', 'DOCUMENT_SCANNED', 'GOVERNMENT_VERIFIED');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'DORMANT', 'BLOCKED', 'CLOSED');

-- CreateEnum
CREATE TYPE "HoldReason" AS ENUM ('CARD_AUTH', 'LEGAL_ARREST', 'MANUAL', 'PAYMENT_PENDING');

-- CreateEnum
CREATE TYPE "HoldStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CAPTURED');

-- CreateEnum
CREATE TYPE "TxnType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'INTERBRANCH', 'INTEREST', 'FEE', 'FX', 'PAYMENT', 'REVERSAL', 'OPENING');

-- CreateEnum
CREATE TYPE "TxnStatus" AS ENUM ('PENDING', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('CURRENT', 'TERM_DEPOSIT', 'SAVINGS', 'LOAN_ANNUITY', 'LOAN_DIFF', 'CARD');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "EodStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentRail" AS ENUM ('INTERNAL', 'AZIPS', 'XOHKS', 'AOS', 'SWIFT');

-- CreateEnum
CREATE TYPE "PaymentOrderStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUBMITTED', 'SETTLED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('ACTIVE', 'MATURED', 'CLOSED', 'EARLY_CLOSED');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('DRAFT', 'APPROVED', 'DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('SCHEDULED', 'DUE', 'PAID', 'OVERDUE', 'WAIVED');

-- CreateEnum
CREATE TYPE "AmlAlertStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'CLOSED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "AmlSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "FmnReportStatus" AS ENUM ('DRAFT', 'FILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RegReportStatus" AS ENUM ('GENERATED', 'VALIDATED', 'EXPORTED');

-- CreateEnum
CREATE TYPE "FatcaCrsClass" AS ENUM ('US_PERSON', 'REPORTABLE', 'NON_REPORTABLE');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('ACTIVE', 'LOCKED', 'DISABLED');

-- CreateEnum
CREATE TYPE "SignatoryRole" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "SignatoryStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "CardScheme" AS ENUM ('VISA', 'MASTERCARD', 'LOCAL');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('DEBIT', 'CREDIT_PREPAID');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'EXPIRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CardTxnType" AS ENUM ('AUTH', 'CAPTURE', 'REVERSAL', 'REFUND');

-- CreateEnum
CREATE TYPE "CardTxnStatus" AS ENUM ('APPROVED', 'DECLINED', 'PENDING', 'SETTLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "CounterpartyType" AS ENUM ('BANK', 'CBAR', 'BROKER_STUB');

-- CreateEnum
CREATE TYPE "ActiveStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "NostroDirection" AS ENUM ('NOSTRO', 'VOSTRO');

-- CreateEnum
CREATE TYPE "FxDealType" AS ENUM ('SPOT', 'FORWARD_STUB');

-- CreateEnum
CREATE TYPE "FxDealStatus" AS ENUM ('BOOKED', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlacementStatus" AS ENUM ('ACTIVE', 'MATURED', 'BROKEN');

-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('ACTIVE', 'MATURED', 'SOLD');

-- CreateTable
CREATE TABLE "gl_accounts" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GlAccountType" NOT NULL,
    "currency" TEXT,
    "is_postable" BOOLEAN NOT NULL DEFAULT true,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gl_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "is_head_office" BOOLEAN NOT NULL DEFAULT false,
    "status" "BranchStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_customers" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "global_person_id" TEXT,
    "voen" TEXT,
    "customer_type" "CustomerType" NOT NULL,
    "risk_rating" "RiskRating" NOT NULL DEFAULT 'LOW',
    "pep_flag" BOOLEAN NOT NULL DEFAULT false,
    "kyc_status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "kyc_trust_tier" "TrustTier" NOT NULL DEFAULT 'SELF_DECLARED',
    "source_of_funds" TEXT,
    "home_branch_id" TEXT NOT NULL,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficial_owners" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "global_person_id" TEXT NOT NULL,
    "share_percent" DECIMAL(7,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beneficial_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "gl_account_id" TEXT NOT NULL,
    "product_id" TEXT,
    "currency" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "ledger_balance_minor" BIGINT NOT NULL DEFAULT 0,
    "available_balance_minor" BIGINT NOT NULL DEFAULT 0,
    "overdraft_limit_minor" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_holds" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "reason" "HoldReason" NOT NULL,
    "status" "HoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_transactions" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "value_date" TIMESTAMP(3) NOT NULL,
    "booking_date" TIMESTAMP(3) NOT NULL,
    "branch_id" TEXT,
    "type" "TxnType" NOT NULL,
    "status" "TxnStatus" NOT NULL DEFAULT 'PENDING',
    "maker_user_id" TEXT NOT NULL,
    "checker_user_id" TEXT,
    "reverses_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "account_id" TEXT,
    "gl_account_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "debit_minor" BIGINT NOT NULL DEFAULT 0,
    "credit_minor" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_templates" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "module_key" TEXT NOT NULL,
    "kind" "ProductKind" NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "params_json" JSONB NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "effective_from" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eod_runs" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "business_date" TIMESTAMP(3) NOT NULL,
    "status" "EodStatus" NOT NULL DEFAULT 'RUNNING',
    "steps" JSONB NOT NULL DEFAULT '{}',
    "balanced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eod_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log_entries" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "actor_user_id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_orders" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "debtor_account_id" TEXT,
    "creditor_iban" TEXT NOT NULL,
    "creditor_name" TEXT,
    "amount_minor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "rail" "PaymentRail" NOT NULL DEFAULT 'INTERNAL',
    "status" "PaymentOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "idempotency_key" TEXT NOT NULL,
    "journal_transaction_id" TEXT,
    "narrative" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_rail_messages" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "payment_order_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "rail" "PaymentRail" NOT NULL,
    "payload_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_rail_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_contracts" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "product_template_id" TEXT NOT NULL,
    "principal_minor" BIGINT NOT NULL,
    "accrued_interest_minor" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "opened_at" TIMESTAMP(3) NOT NULL,
    "maturity_date" TIMESTAMP(3),
    "status" "DepositStatus" NOT NULL DEFAULT 'ACTIVE',
    "adif_tagged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deposit_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_contracts" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "account_id" TEXT,
    "product_template_id" TEXT NOT NULL,
    "principal_minor" BIGINT NOT NULL,
    "outstanding_minor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "status" "LoanStatus" NOT NULL DEFAULT 'DRAFT',
    "ifrs9_stage" INTEGER NOT NULL DEFAULT 1,
    "akb_score" INTEGER,
    "collateral_ref" TEXT,
    "disbursed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_schedule_installments" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "loan_id" TEXT NOT NULL,
    "sequence_no" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "principal_minor" BIGINT NOT NULL,
    "interest_minor" BIGINT NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "loan_schedule_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aml_rules" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "params_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aml_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aml_alerts" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "status" "AmlAlertStatus" NOT NULL DEFAULT 'OPEN',
    "severity" "AmlSeverity" NOT NULL DEFAULT 'MEDIUM',
    "rule_code" TEXT NOT NULL,
    "transaction_id" TEXT,
    "customer_id" TEXT,
    "counterparty_ref" TEXT,
    "amount_minor" BIGINT,
    "currency" TEXT,
    "narrative" TEXT NOT NULL,
    "assigned_to_user_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aml_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aml_screening_hits" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "alert_id" TEXT,
    "list_source" TEXT NOT NULL,
    "matched_name" TEXT NOT NULL,
    "match_score" DECIMAL(5,2) NOT NULL,
    "screened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cleared" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "aml_screening_hits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fmn_reports" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "period_from" TIMESTAMP(3) NOT NULL,
    "period_to" TIMESTAMP(3) NOT NULL,
    "status" "FmnReportStatus" NOT NULL DEFAULT 'DRAFT',
    "payload_json" JSONB NOT NULL,
    "filed_at" TIMESTAMP(3),
    "filed_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fmn_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reg_report_runs" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "template_code" TEXT NOT NULL,
    "period_from" TIMESTAMP(3) NOT NULL,
    "period_to" TIMESTAMP(3) NOT NULL,
    "status" "RegReportStatus" NOT NULL DEFAULT 'GENERATED',
    "output_json" JSONB NOT NULL,
    "exported_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reg_report_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fatca_crs_classifications" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "classification" "FatcaCrsClass" NOT NULL,
    "tin_status" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fatca_crs_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dbo_customer_credentials" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "login_hash" TEXT NOT NULL,
    "password_hash" TEXT,
    "status" "CredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dbo_customer_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dbo_otp_challenges" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dbo_otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corporate_signatories" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "global_person_id" TEXT NOT NULL,
    "role" "SignatoryRole" NOT NULL,
    "limit_minor" BIGINT,
    "status" "SignatoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corporate_signatories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_products" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "product_template_id" TEXT NOT NULL,
    "scheme" "CardScheme" NOT NULL,
    "card_type" "CardType" NOT NULL,
    "default_limits_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "card_token" TEXT NOT NULL,
    "pan_last4" TEXT NOT NULL,
    "bin6" TEXT NOT NULL,
    "expiry_month" INTEGER NOT NULL,
    "expiry_year" INTEGER NOT NULL,
    "status" "CardStatus" NOT NULL DEFAULT 'ACTIVE',
    "block_reason" TEXT,
    "limits_json" JSONB NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_transactions" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "hold_id" TEXT,
    "posting_txn_id" TEXT,
    "type" "CardTxnType" NOT NULL,
    "status" "CardTxnStatus" NOT NULL DEFAULT 'PENDING',
    "amount_minor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "merchant_name" TEXT,
    "merchant_mcc" TEXT,
    "processor_ref" TEXT NOT NULL,
    "auth_code" TEXT,
    "decline_reason" TEXT,
    "authorized_at" TIMESTAMP(3),
    "captured_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_processor_messages" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "card_txn_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_processor_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_counterparties" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "bank_mfo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nostro_iban" TEXT,
    "type" "CounterpartyType" NOT NULL,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treasury_counterparties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nostro_vostro_accounts" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "counterparty_id" TEXT,
    "direction" "NostroDirection" NOT NULL,
    "iban" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "gl_account_id" TEXT NOT NULL,
    "ledger_balance_minor" BIGINT NOT NULL DEFAULT 0,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nostro_vostro_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fx_deals" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "deal_type" "FxDealType" NOT NULL,
    "base_currency" TEXT NOT NULL,
    "quote_currency" TEXT NOT NULL,
    "base_amount_minor" BIGINT NOT NULL,
    "quote_amount_minor" BIGINT NOT NULL,
    "rate" DECIMAL(19,8) NOT NULL,
    "value_date" TIMESTAMP(3) NOT NULL,
    "status" "FxDealStatus" NOT NULL DEFAULT 'BOOKED',
    "posting_txn_id" TEXT,
    "counterparty_id" TEXT,
    "booked_by_user_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interbank_placements" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "counterparty_id" TEXT NOT NULL,
    "nostro_account_id" TEXT NOT NULL,
    "principal_minor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "rate_annual" DECIMAL(9,6) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "maturity_date" TIMESTAMP(3) NOT NULL,
    "status" "PlacementStatus" NOT NULL DEFAULT 'ACTIVE',
    "open_posting_txn_id" TEXT,
    "close_posting_txn_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interbank_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gov_security_positions" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "isin" TEXT NOT NULL,
    "face_value_minor" BIGINT NOT NULL,
    "book_value_minor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "maturity_date" TIMESTAMP(3) NOT NULL,
    "status" "PositionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gov_security_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidity_gap_snapshots" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "as_of_date" TIMESTAMP(3) NOT NULL,
    "buckets_json" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liquidity_gap_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gl_accounts_bank_org_id_idx" ON "gl_accounts"("bank_org_id");

-- CreateIndex
CREATE UNIQUE INDEX "gl_accounts_bank_org_id_code_key" ON "gl_accounts"("bank_org_id", "code");

-- CreateIndex
CREATE INDEX "branches_bank_org_id_idx" ON "branches"("bank_org_id");

-- CreateIndex
CREATE UNIQUE INDEX "branches_bank_org_id_code_key" ON "branches"("bank_org_id", "code");

-- CreateIndex
CREATE INDEX "bank_customers_bank_org_id_idx" ON "bank_customers"("bank_org_id");

-- CreateIndex
CREATE INDEX "bank_customers_global_person_id_idx" ON "bank_customers"("global_person_id");

-- CreateIndex
CREATE INDEX "bank_customers_voen_idx" ON "bank_customers"("voen");

-- CreateIndex
CREATE INDEX "beneficial_owners_customer_id_idx" ON "beneficial_owners"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_iban_key" ON "accounts"("iban");

-- CreateIndex
CREATE INDEX "accounts_bank_org_id_idx" ON "accounts"("bank_org_id");

-- CreateIndex
CREATE INDEX "accounts_customer_id_idx" ON "accounts"("customer_id");

-- CreateIndex
CREATE INDEX "accounts_branch_id_idx" ON "accounts"("branch_id");

-- CreateIndex
CREATE INDEX "account_holds_account_id_status_idx" ON "account_holds"("account_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "journal_transactions_idempotency_key_key" ON "journal_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "journal_transactions_bank_org_id_status_idx" ON "journal_transactions"("bank_org_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "journal_transactions_bank_org_id_reference_key" ON "journal_transactions"("bank_org_id", "reference");

-- CreateIndex
CREATE INDEX "journal_entries_transaction_id_idx" ON "journal_entries"("transaction_id");

-- CreateIndex
CREATE INDEX "journal_entries_account_id_idx" ON "journal_entries"("account_id");

-- CreateIndex
CREATE INDEX "product_templates_bank_org_id_module_key_status_idx" ON "product_templates"("bank_org_id", "module_key", "status");

-- CreateIndex
CREATE UNIQUE INDEX "eod_runs_bank_org_id_business_date_key" ON "eod_runs"("bank_org_id", "business_date");

-- CreateIndex
CREATE INDEX "audit_log_entries_bank_org_id_entity_entity_id_idx" ON "audit_log_entries"("bank_org_id", "entity", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_idempotency_key_key" ON "payment_orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "payment_orders_bank_org_id_status_idx" ON "payment_orders"("bank_org_id", "status");

-- CreateIndex
CREATE INDEX "payment_rail_messages_payment_order_id_idx" ON "payment_rail_messages"("payment_order_id");

-- CreateIndex
CREATE INDEX "deposit_contracts_bank_org_id_customer_id_idx" ON "deposit_contracts"("bank_org_id", "customer_id");

-- CreateIndex
CREATE INDEX "deposit_contracts_account_id_idx" ON "deposit_contracts"("account_id");

-- CreateIndex
CREATE INDEX "loan_contracts_bank_org_id_customer_id_idx" ON "loan_contracts"("bank_org_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_schedule_installments_loan_id_sequence_no_key" ON "loan_schedule_installments"("loan_id", "sequence_no");

-- CreateIndex
CREATE UNIQUE INDEX "aml_rules_bank_org_id_code_key" ON "aml_rules"("bank_org_id", "code");

-- CreateIndex
CREATE INDEX "aml_alerts_bank_org_id_status_idx" ON "aml_alerts"("bank_org_id", "status");

-- CreateIndex
CREATE INDEX "aml_screening_hits_alert_id_idx" ON "aml_screening_hits"("alert_id");

-- CreateIndex
CREATE INDEX "fmn_reports_bank_org_id_status_idx" ON "fmn_reports"("bank_org_id", "status");

-- CreateIndex
CREATE INDEX "reg_report_runs_bank_org_id_template_code_idx" ON "reg_report_runs"("bank_org_id", "template_code");

-- CreateIndex
CREATE UNIQUE INDEX "fatca_crs_classifications_bank_org_id_customer_id_key" ON "fatca_crs_classifications"("bank_org_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "dbo_customer_credentials_bank_org_id_customer_id_key" ON "dbo_customer_credentials"("bank_org_id", "customer_id");

-- CreateIndex
CREATE INDEX "dbo_otp_challenges_customer_id_idx" ON "dbo_otp_challenges"("customer_id");

-- CreateIndex
CREATE INDEX "corporate_signatories_customer_id_idx" ON "corporate_signatories"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "card_products_product_template_id_key" ON "card_products"("product_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "cards_card_token_key" ON "cards"("card_token");

-- CreateIndex
CREATE INDEX "cards_customer_id_idx" ON "cards"("customer_id");

-- CreateIndex
CREATE INDEX "cards_account_id_idx" ON "cards"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "card_transactions_processor_ref_key" ON "card_transactions"("processor_ref");

-- CreateIndex
CREATE INDEX "card_transactions_card_id_idx" ON "card_transactions"("card_id");

-- CreateIndex
CREATE INDEX "card_processor_messages_card_txn_id_idx" ON "card_processor_messages"("card_txn_id");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_counterparties_bank_org_id_bank_mfo_key" ON "treasury_counterparties"("bank_org_id", "bank_mfo");

-- CreateIndex
CREATE UNIQUE INDEX "nostro_vostro_accounts_iban_key" ON "nostro_vostro_accounts"("iban");

-- CreateIndex
CREATE INDEX "nostro_vostro_accounts_bank_org_id_idx" ON "nostro_vostro_accounts"("bank_org_id");

-- CreateIndex
CREATE UNIQUE INDEX "fx_deals_idempotency_key_key" ON "fx_deals"("idempotency_key");

-- CreateIndex
CREATE INDEX "fx_deals_bank_org_id_status_idx" ON "fx_deals"("bank_org_id", "status");

-- CreateIndex
CREATE INDEX "interbank_placements_bank_org_id_status_idx" ON "interbank_placements"("bank_org_id", "status");

-- CreateIndex
CREATE INDEX "gov_security_positions_bank_org_id_idx" ON "gov_security_positions"("bank_org_id");

-- CreateIndex
CREATE INDEX "liquidity_gap_snapshots_bank_org_id_as_of_date_idx" ON "liquidity_gap_snapshots"("bank_org_id", "as_of_date");

-- AddForeignKey
ALTER TABLE "beneficial_owners" ADD CONSTRAINT "beneficial_owners_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "bank_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_holds" ADD CONSTRAINT "account_holds_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "journal_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_rail_messages" ADD CONSTRAINT "payment_rail_messages_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_schedule_installments" ADD CONSTRAINT "loan_schedule_installments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loan_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aml_screening_hits" ADD CONSTRAINT "aml_screening_hits_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "aml_alerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
