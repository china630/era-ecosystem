ALTER TABLE "SettlementPendingCharge" ADD COLUMN "basket_ref" TEXT;

CREATE INDEX "SettlementPendingCharge_organizationId_basket_ref_idx"
  ON "SettlementPendingCharge"("organizationId", "basket_ref");
