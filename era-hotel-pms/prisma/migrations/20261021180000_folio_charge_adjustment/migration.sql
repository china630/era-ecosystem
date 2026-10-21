ALTER TABLE "FolioCharge" ADD COLUMN "adjustsChargeId" TEXT;
ALTER TABLE "FolioCharge" ADD COLUMN "adjustmentReason" TEXT;
CREATE INDEX "FolioCharge_adjustsChargeId_idx" ON "FolioCharge"("adjustsChargeId");
