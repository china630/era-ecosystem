-- Settlement hub: pending charges from department satellites + primary cash shift flag

CREATE TYPE "SettlementPendingStatus" AS ENUM ('PENDING', 'PAID', 'VOID');
CREATE TYPE "SettlementSourceSystem" AS ENUM ('FNB_POS', 'CLINIC', 'RETAIL');

ALTER TABLE "CashShift" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SettlementPendingCharge" (
    "id" TEXT NOT NULL,
    "status" "SettlementPendingStatus" NOT NULL DEFAULT 'PENDING',
    "sourceSystem" "SettlementSourceSystem" NOT NULL,
    "sourceOrgId" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "description" TEXT NOT NULL,
    "payerLabel" TEXT,
    "globalPersonId" TEXT,
    "reservationId" TEXT,
    "cashShiftId" TEXT,
    "paymentMethod" TEXT,
    "fiscalReceiptId" TEXT,
    "fiscalQrPayload" TEXT,
    "paidAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "businessDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementPendingCharge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SettlementPendingCharge_idempotencyKey_key" ON "SettlementPendingCharge"("idempotencyKey");
CREATE INDEX "SettlementPendingCharge_status_businessDate_idx" ON "SettlementPendingCharge"("status", "businessDate");
CREATE INDEX "SettlementPendingCharge_sourceSystem_sourceRef_idx" ON "SettlementPendingCharge"("sourceSystem", "sourceRef");

ALTER TABLE "SettlementPendingCharge" ADD CONSTRAINT "SettlementPendingCharge_cashShiftId_fkey" FOREIGN KEY ("cashShiftId") REFERENCES "CashShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
