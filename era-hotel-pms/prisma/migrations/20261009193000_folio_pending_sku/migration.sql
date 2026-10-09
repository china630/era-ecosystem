ALTER TABLE "FolioCharge" ADD COLUMN "sku" TEXT;

ALTER TABLE "SettlementPendingCharge" ADD COLUMN "sku" TEXT;
ALTER TABLE "SettlementPendingCharge" ADD COLUMN "qty" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SettlementPendingCharge" ADD COLUMN "revenueCode" TEXT;
