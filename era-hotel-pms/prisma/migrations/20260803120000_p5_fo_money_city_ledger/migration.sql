-- P5 FO money / City Ledger
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'DEPOSIT';
ALTER TYPE "FolioStatus" ADD VALUE IF NOT EXISTS 'PENDING_AR';
ALTER TYPE "FolioStatus" ADD VALUE IF NOT EXISTS 'TRANSFERRED_AR';

DO $$ BEGIN
  CREATE TYPE "FolioPaymentKind" AS ENUM ('PAYMENT', 'REFUND');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "creditLimitAzn" DECIMAL(12,2);
ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "paymentTermsDays" INTEGER;

ALTER TABLE "FolioPayment" ADD COLUMN IF NOT EXISTS "kind" "FolioPaymentKind" NOT NULL DEFAULT 'PAYMENT';
ALTER TABLE "FolioPayment" ADD COLUMN IF NOT EXISTS "refundOfPaymentId" TEXT;
ALTER TABLE "FolioPayment" ADD COLUMN IF NOT EXISTS "refundReason" TEXT;

CREATE INDEX IF NOT EXISTS "FolioPayment_refundOfPaymentId_idx" ON "FolioPayment"("refundOfPaymentId");

DO $$ BEGIN
  ALTER TABLE "FolioPayment"
    ADD CONSTRAINT "FolioPayment_refundOfPaymentId_fkey"
    FOREIGN KEY ("refundOfPaymentId") REFERENCES "FolioPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;