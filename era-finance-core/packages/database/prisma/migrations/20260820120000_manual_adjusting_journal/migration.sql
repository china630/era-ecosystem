CREATE TYPE "TransactionKind" AS ENUM ('SYSTEM', 'MANUAL_ADJUSTMENT');

ALTER TABLE "transactions"
  ADD COLUMN "kind" "TransactionKind" NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "manual_template" TEXT,
  ADD COLUMN "basis_invoice_id" UUID;

CREATE INDEX "transactions_organization_id_kind_date_idx"
  ON "transactions"("organization_id", "kind", "date");
