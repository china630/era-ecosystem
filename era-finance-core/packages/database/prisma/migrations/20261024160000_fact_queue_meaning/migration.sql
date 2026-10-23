-- Fact-queue meaning. Does not post and does not close a period by itself.

CREATE TYPE "FactMeaning" AS ENUM (
  'CUSTOMER_PAYMENT',
  'SUPPLIER_PAYMENT',
  'FOUNDER_LOAN_IN',
  'FOUNDER_LOAN_RETURN',
  'OWNER_WITHDRAWAL',
  'BANK_COMMISSION',
  'DUPLICATE_OR_ERROR'
);

ALTER TABLE "bank_statement_lines"
  ADD COLUMN "fact_meaning" "FactMeaning",
  ADD COLUMN "fact_purchase_transaction_id" UUID,
  ADD COLUMN "fact_counterparty_id" UUID,
  ADD COLUMN "fact_transaction_id" UUID,
  ADD COLUMN "fact_confirmed_mismatch" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "cash_orders"
  ADD COLUMN "fact_meaning" "FactMeaning",
  ADD COLUMN "fact_purchase_transaction_id" UUID,
  ADD COLUMN "fact_transaction_id" UUID,
  ADD COLUMN "fact_confirmed_mismatch" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "counterparties"
  ADD COLUMN "is_founder" BOOLEAN NOT NULL DEFAULT false;
