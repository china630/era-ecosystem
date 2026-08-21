CREATE TYPE "InvoicePaymentKind" AS ENUM ('PAYMENT', 'NETTING', 'CREDIT_ADJUSTMENT');

ALTER TABLE "invoice_payments"
  ADD COLUMN "kind" "InvoicePaymentKind" NOT NULL DEFAULT 'PAYMENT';

ALTER TABLE "transactions"
  ADD COLUMN "basis_fixed_asset_id" UUID;
