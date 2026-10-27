-- CheckoutSettlementStatus for deferred corporate / City Ledger handoff
CREATE TYPE "CheckoutSettlementStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'INVOICED', 'SETTLED');
ALTER TABLE "Reservation" ADD COLUMN "checkoutSettlementStatus" "CheckoutSettlementStatus" NOT NULL DEFAULT 'NOT_APPLICABLE';
CREATE INDEX "Reservation_checkoutSettlementStatus_idx" ON "Reservation"("checkoutSettlementStatus");
