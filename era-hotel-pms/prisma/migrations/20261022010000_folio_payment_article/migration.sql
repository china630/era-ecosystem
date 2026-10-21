-- Persist payment article so prepaid ROOM credit does not spill onto extras.
ALTER TABLE "FolioPayment" ADD COLUMN "revenueCodeId" TEXT;

CREATE INDEX "FolioPayment_revenueCodeId_idx" ON "FolioPayment"("revenueCodeId");

ALTER TABLE "FolioPayment"
  ADD CONSTRAINT "FolioPayment_revenueCodeId_fkey"
  FOREIGN KEY ("revenueCodeId") REFERENCES "RevenueCode"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
