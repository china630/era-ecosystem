-- Settlement hub: walk-in visits defer to hotel Front Cash

ALTER TYPE "BillingTarget" ADD VALUE IF NOT EXISTS 'SETTLEMENT_HUB';

ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "settlementPendingId" TEXT;
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "hubFiscalReceiptId" TEXT;
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "settledAt" TIMESTAMP(3);
