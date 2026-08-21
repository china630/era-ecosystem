ALTER TABLE "transactions"
  ADD COLUMN "reverses_transaction_id" UUID;

CREATE UNIQUE INDEX "transactions_reverses_transaction_id_key"
  ON "transactions"("reverses_transaction_id");

CREATE INDEX "transactions_organization_id_reverses_transaction_id_idx"
  ON "transactions"("organization_id", "reverses_transaction_id");

ALTER TYPE "InvoicePaymentKind" ADD VALUE 'CREDIT_ADJUSTMENT_REVERSAL';
