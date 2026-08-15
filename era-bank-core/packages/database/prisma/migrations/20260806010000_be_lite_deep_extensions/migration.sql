-- BE Lite → Deep extensions (era-bank-core)
-- ProductKind / TxnType / CIF + domain tables for fee/cash/collections/trade/…

-- Enums (PostgreSQL 15+ IF NOT EXISTS on ADD VALUE)
ALTER TYPE "ProductKind" ADD VALUE IF NOT EXISTS 'CALL_DEPOSIT';
ALTER TYPE "ProductKind" ADD VALUE IF NOT EXISTS 'STRUCTURED_DEPOSIT';
ALTER TYPE "ProductKind" ADD VALUE IF NOT EXISTS 'LOAN_LINE';
ALTER TYPE "ProductKind" ADD VALUE IF NOT EXISTS 'LOAN_MORTGAGE';
ALTER TYPE "ProductKind" ADD VALUE IF NOT EXISTS 'LOAN_LEASE';
ALTER TYPE "ProductKind" ADD VALUE IF NOT EXISTS 'LOAN_FACTORING';
ALTER TYPE "ProductKind" ADD VALUE IF NOT EXISTS 'LOAN_MFI';
ALTER TYPE "ProductKind" ADD VALUE IF NOT EXISTS 'LOAN_TRADE';
ALTER TYPE "ProductKind" ADD VALUE IF NOT EXISTS 'LOAN_SYNDICATED';
ALTER TYPE "ProductKind" ADD VALUE IF NOT EXISTS 'LOAN_PROJECT';
ALTER TYPE "ProductKind" ADD VALUE IF NOT EXISTS 'MURABAHA';
ALTER TYPE "ProductKind" ADD VALUE IF NOT EXISTS 'MUDARABAH';
ALTER TYPE "TxnType" ADD VALUE IF NOT EXISTS 'CONTINGENT';

DO $$ BEGIN
  CREATE TYPE "FeeTariffStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "SafeDepositBoxStatus" AS ENUM ('AVAILABLE', 'RENTED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CashMovementKind" AS ENUM ('TILL_TO_VAULT', 'VAULT_TO_TILL', 'CIT_IN', 'CIT_OUT', 'TELLER_IN', 'TELLER_OUT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CashMovementStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "InventoryItemKind" AS ENUM ('BLANK_FORM', 'CARD_STOCK', 'CHEQUEBOOK', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "BranchQueueStatus" AS ENUM ('WAITING', 'SERVING', 'DONE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "LoanApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'BOOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CreditLineStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "DrawdownStatus" AS ENUM ('REQUESTED', 'APPROVED', 'DISBURSED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CollectionCaseStatus" AS ENUM ('OPEN', 'ASSIGNED', 'PTP', 'LEGAL', 'CLOSED', 'WRITTEN_OFF');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "StandingOrderStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "DirectDebitMandateStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "VirtualAccountStatus" AS ENUM ('ACTIVE', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ChequeStatus" AS ENUM ('ISSUED', 'PRESENTED', 'CLEARED', 'BOUNCED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "SweepRuleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "TradeInstrumentStatus" AS ENUM ('DRAFT', 'ISSUED', 'ADVISED', 'AMENDED', 'DOCUMENTS_PRESENTED', 'PAID', 'REFUSED', 'RELEASED', 'CANCELLED', 'CLAIMED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "TradeSwiftMessageStatus" AS ENUM ('QUEUED', 'SENT_STUB', 'ACKED_STUB', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CardDisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'WON', 'LOST', 'WRITTEN_OFF');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ThreeDsChallengeStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CustodyPositionStatus" AS ENUM ('ACTIVE', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "IslamicContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'MATURED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "H2hJobStatus" AS ENUM ('RECEIVED', 'PARSED', 'APPLIED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ObConsentStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "AmlCaseStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'SAR_DRAFT', 'SAR_FILED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "OpRiskEventStatus" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "bank_customers" ADD COLUMN IF NOT EXISTS "ml_score_placeholder" INTEGER;

CREATE TABLE IF NOT EXISTS "fee_tariffs" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "amount_minor" BIGINT NOT NULL,
  "gl_income_key" TEXT NOT NULL DEFAULT 'FEE_INCOME',
  "status" "FeeTariffStatus" NOT NULL DEFAULT 'DRAFT',
  "params_json" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "fee_tariffs_bank_org_id_code_key" ON "fee_tariffs"("bank_org_id", "code");

CREATE TABLE IF NOT EXISTS "relationship_packages" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "params_json" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "relationship_packages_bank_org_id_code_key" ON "relationship_packages"("bank_org_id", "code");

CREATE TABLE IF NOT EXISTS "relationship_package_links" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "package_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "relationship_package_links_package_id_customer_id_key" ON "relationship_package_links"("package_id", "customer_id");

CREATE TABLE IF NOT EXISTS "safe_deposit_boxes" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "box_number" TEXT NOT NULL,
  "customer_id" TEXT,
  "rent_minor" BIGINT NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "status" "SafeDepositBoxStatus" NOT NULL DEFAULT 'AVAILABLE',
  "rented_at" TIMESTAMP(3),
  "next_rent_date" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "safe_deposit_boxes_bank_org_id_branch_id_box_number_key" ON "safe_deposit_boxes"("bank_org_id", "branch_id", "box_number");

CREATE TABLE IF NOT EXISTS "cash_movements" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "kind" "CashMovementKind" NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "status" "CashMovementStatus" NOT NULL DEFAULT 'DRAFT',
  "reference" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "journal_txn_id" TEXT,
  "maker_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "cash_movements_idempotency_key_key" ON "cash_movements"("idempotency_key");

CREATE TABLE IF NOT EXISTS "inventory_items" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "kind" "InventoryItemKind" NOT NULL,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_bank_org_id_branch_id_sku_key" ON "inventory_items"("bank_org_id", "branch_id", "sku");

CREATE TABLE IF NOT EXISTS "inventory_movements" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "delta_qty" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "maker_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "branch_queue_tickets" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "ticket_no" INTEGER NOT NULL,
  "customer_id" TEXT,
  "service_key" TEXT NOT NULL DEFAULT 'GENERAL',
  "status" "BranchQueueStatus" NOT NULL DEFAULT 'WAITING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "branch_queue_tickets_bank_org_id_branch_id_ticket_no_key" ON "branch_queue_tickets"("bank_org_id", "branch_id", "ticket_no");

CREATE TABLE IF NOT EXISTS "collateral_valuations" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "loan_id" TEXT NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "valued_at" TIMESTAMP(3) NOT NULL,
  "valuer_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "lien_registers" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "loan_id" TEXT NOT NULL,
  "lien_ref" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "registered_at" TIMESTAMP(3) NOT NULL,
  "released_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "lien_registers_bank_org_id_lien_ref_key" ON "lien_registers"("bank_org_id", "lien_ref");

CREATE TABLE IF NOT EXISTS "credit_decision_requests" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "application_id" TEXT,
  "rules_json" JSONB NOT NULL,
  "score" INTEGER,
  "decision" TEXT,
  "reason_codes" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "loan_applications" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "product_template_id" TEXT NOT NULL,
  "requested_minor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "status" "LoanApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  "loan_id" TEXT,
  "maker_user_id" TEXT,
  "checker_user_id" TEXT,
  "reject_reason" TEXT,
  "forbearance_reason" TEXT,
  "watchlist" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "credit_lines" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "product_template_id" TEXT NOT NULL,
  "limit_minor" BIGINT NOT NULL,
  "drawn_minor" BIGINT NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "status" "CreditLineStatus" NOT NULL DEFAULT 'ACTIVE',
  "participation_pct" DECIMAL(7,4),
  "lead_bank_name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "credit_line_drawdowns" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "credit_line_id" TEXT NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "account_id" TEXT,
  "status" "DrawdownStatus" NOT NULL DEFAULT 'REQUESTED',
  "loan_id" TEXT,
  "journal_txn_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "maker_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "credit_line_drawdowns_idempotency_key_key" ON "credit_line_drawdowns"("idempotency_key");

CREATE TABLE IF NOT EXISTS "collection_cases" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "loan_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "status" "CollectionCaseStatus" NOT NULL DEFAULT 'OPEN',
  "assignee_user_id" TEXT,
  "outstanding_minor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "collection_promises_to_pay" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "case_id" TEXT NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "due_date" TIMESTAMP(3) NOT NULL,
  "kept" BOOLEAN,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "standing_orders" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "from_account_id" TEXT NOT NULL,
  "to_iban" TEXT NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "cron_expr" TEXT NOT NULL DEFAULT '0 9 * * 1',
  "next_run_at" TIMESTAMP(3) NOT NULL,
  "status" "StandingOrderStatus" NOT NULL DEFAULT 'ACTIVE',
  "last_run_at" TIMESTAMP(3),
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "standing_orders_idempotency_key_key" ON "standing_orders"("idempotency_key");

CREATE TABLE IF NOT EXISTS "direct_debit_mandates" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "creditor_name" TEXT NOT NULL,
  "creditor_ref" TEXT NOT NULL,
  "max_amount_minor" BIGINT,
  "status" "DirectDebitMandateStatus" NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "direct_debit_mandates_bank_org_id_creditor_ref_key" ON "direct_debit_mandates"("bank_org_id", "creditor_ref");

CREATE TABLE IF NOT EXISTS "virtual_accounts" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "parent_account_id" TEXT NOT NULL,
  "virtual_iban" TEXT NOT NULL,
  "status" "VirtualAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "virtual_accounts_bank_org_id_virtual_iban_key" ON "virtual_accounts"("bank_org_id", "virtual_iban");

CREATE TABLE IF NOT EXISTS "cash_pool_sweep_rules" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "master_account_id" TEXT NOT NULL,
  "child_account_id" TEXT NOT NULL,
  "target_minor" BIGINT NOT NULL DEFAULT 0,
  "status" "SweepRuleStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "cheque_instruments" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "cheque_number" TEXT NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "payee_name" TEXT NOT NULL,
  "status" "ChequeStatus" NOT NULL DEFAULT 'ISSUED',
  "presented_at" TIMESTAMP(3),
  "cleared_at" TIMESTAMP(3),
  "journal_txn_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "cheque_instruments_bank_org_id_cheque_number_key" ON "cheque_instruments"("bank_org_id", "cheque_number");

CREATE TABLE IF NOT EXISTS "letters_of_credit" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "direction" TEXT NOT NULL DEFAULT 'IMPORT',
  "reference" TEXT NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "status" "TradeInstrumentStatus" NOT NULL DEFAULT 'DRAFT',
  "beneficiary_name" TEXT,
  "docs_checklist" JSONB NOT NULL DEFAULT '[]',
  "margin_minor" BIGINT NOT NULL DEFAULT 0,
  "journal_txn_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "letters_of_credit_bank_org_id_reference_key" ON "letters_of_credit"("bank_org_id", "reference");

CREATE TABLE IF NOT EXISTS "trade_lc_amendments" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "lc_id" TEXT NOT NULL,
  "seq_no" INTEGER NOT NULL,
  "note" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "trade_lc_amendments_lc_id_seq_no_key" ON "trade_lc_amendments"("lc_id", "seq_no");

CREATE TABLE IF NOT EXISTS "bank_guarantees" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "kind" TEXT NOT NULL DEFAULT 'BG',
  "status" "TradeInstrumentStatus" NOT NULL DEFAULT 'DRAFT',
  "beneficiary_name" TEXT,
  "journal_txn_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "bank_guarantees_bank_org_id_reference_key" ON "bank_guarantees"("bank_org_id", "reference");

CREATE TABLE IF NOT EXISTS "documentary_collections" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "status" "TradeInstrumentStatus" NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "documentary_collections_bank_org_id_reference_key" ON "documentary_collections"("bank_org_id", "reference");

CREATE TABLE IF NOT EXISTS "scf_programs" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "anchor_buyer_id" TEXT,
  "params_json" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "scf_programs_bank_org_id_code_key" ON "scf_programs"("bank_org_id", "code");

CREATE TABLE IF NOT EXISTS "trade_swift_messages" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "mt_type" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "related_ref" TEXT,
  "status" "TradeSwiftMessageStatus" NOT NULL DEFAULT 'QUEUED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "card_dispute_cases" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "card_transaction_id" TEXT NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "reason_code" TEXT NOT NULL,
  "status" "CardDisputeStatus" NOT NULL DEFAULT 'OPEN',
  "journal_txn_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "three_ds_challenges" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "card_id" TEXT NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "status" "ThreeDsChallengeStatus" NOT NULL DEFAULT 'PENDING',
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "safekeeping_accounts" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "account_no" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "safekeeping_accounts_bank_org_id_account_no_key" ON "safekeeping_accounts"("bank_org_id", "account_no");

CREATE TABLE IF NOT EXISTS "custody_positions" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "safekeeping_account_id" TEXT NOT NULL,
  "isin" TEXT NOT NULL,
  "quantity" DECIMAL(18,6) NOT NULL,
  "status" "CustodyPositionStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "islamic_contracts" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "product_template_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "principal_minor" BIGINT NOT NULL,
  "profit_minor" BIGINT NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "status" "IslamicContractStatus" NOT NULL DEFAULT 'DRAFT',
  "journal_txn_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "dbo_h2h_file_jobs" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "status" "H2hJobStatus" NOT NULL DEFAULT 'RECEIVED',
  "result_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "open_banking_consents" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "scopes" JSONB NOT NULL DEFAULT '[]',
  "status" "ObConsentStatus" NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "aml_cases" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "alert_id" TEXT,
  "customer_id" TEXT,
  "status" "AmlCaseStatus" NOT NULL DEFAULT 'OPEN',
  "sar_draft" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "fraud_score_requests" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "score" INTEGER NOT NULL,
  "reason_codes" JSONB NOT NULL DEFAULT '[]',
  "hold_payment" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "irrbb_inputs" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "as_of_date" TIMESTAMP(3) NOT NULL,
  "bucket_key" TEXT NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "rate_bps" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "oprisk_loss_events" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "event_date" TIMESTAMP(3) NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "OpRiskEventStatus" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "insurance_affiliate_commissions" (
  "id" TEXT PRIMARY KEY,
  "bank_org_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "policy_ref" TEXT NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
