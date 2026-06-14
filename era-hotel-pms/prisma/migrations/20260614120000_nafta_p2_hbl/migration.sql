-- Nafta P2 H-BL schema: business date, credit limit, deposits, pre-auth, split settlement

-- PaymentMethod: LOYALTY_POINTS
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'LOYALTY_POINTS';

-- New enums
CREATE TYPE "FolioDepositStatus" AS ENUM ('HELD', 'APPLIED', 'REFUNDED', 'FORFEITED');
CREATE TYPE "CardAuthorizationStatus" AS ENUM ('HELD', 'CAPTURED', 'RELEASED', 'EXPIRED', 'VOIDED');
CREATE TYPE "FolioSettlementStatus" AS ENUM ('OPEN', 'COMPLETED', 'VOID');

-- HotelProfile operational fields
ALTER TABLE "HotelProfile" ADD COLUMN IF NOT EXISTS "currentBusinessDate" DATE;
ALTER TABLE "HotelProfile" ADD COLUMN IF NOT EXISTS "businessDateLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HotelProfile" ADD COLUMN IF NOT EXISTS "defaultCreditLimitAzn" DECIMAL(12,2);
ALTER TABLE "HotelProfile" ADD COLUMN IF NOT EXISTS "policyJson" TEXT;

-- Reservation credit override
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "creditLimitAzn" DECIMAL(12,2);

-- FolioPayment settlement link
ALTER TABLE "FolioPayment" ADD COLUMN IF NOT EXISTS "settlementId" TEXT;
CREATE INDEX IF NOT EXISTS "FolioPayment_settlementId_idx" ON "FolioPayment"("settlementId");

-- FolioSettlement
CREATE TABLE IF NOT EXISTS "FolioSettlement" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "status" "FolioSettlementStatus" NOT NULL DEFAULT 'OPEN',
    "totalDue" DECIMAL(12,2) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FolioSettlement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FolioSettlement_reservationId_idx" ON "FolioSettlement"("reservationId");
CREATE INDEX IF NOT EXISTS "FolioSettlement_folioId_idx" ON "FolioSettlement"("folioId");
ALTER TABLE "FolioSettlement" ADD CONSTRAINT "FolioSettlement_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FolioSettlement" ADD CONSTRAINT "FolioSettlement_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FolioPayment" ADD CONSTRAINT "FolioPayment_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "FolioSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- FolioDeposit
CREATE TABLE IF NOT EXISTS "FolioDeposit" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "folioId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "status" "FolioDepositStatus" NOT NULL DEFAULT 'HELD',
    "registerRef" TEXT,
    "externalRef" TEXT,
    "heldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FolioDeposit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FolioDeposit_reservationId_idx" ON "FolioDeposit"("reservationId");
CREATE INDEX IF NOT EXISTS "FolioDeposit_status_idx" ON "FolioDeposit"("status");
ALTER TABLE "FolioDeposit" ADD CONSTRAINT "FolioDeposit_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FolioDeposit" ADD CONSTRAINT "FolioDeposit_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CardAuthorization
CREATE TABLE IF NOT EXISTS "CardAuthorization" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "folioId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "CardAuthorizationStatus" NOT NULL DEFAULT 'HELD',
    "externalAuthId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardAuthorization_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CardAuthorization_reservationId_idx" ON "CardAuthorization"("reservationId");
CREATE INDEX IF NOT EXISTS "CardAuthorization_status_idx" ON "CardAuthorization"("status");
ALTER TABLE "CardAuthorization" ADD CONSTRAINT "CardAuthorization_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Init currentBusinessDate from latest BusinessDay or today
UPDATE "HotelProfile"
SET "currentBusinessDate" = COALESCE(
  (SELECT "date" FROM "BusinessDay" WHERE "status" = 'OPEN' ORDER BY "date" DESC LIMIT 1),
  (SELECT "date" FROM "BusinessDay" ORDER BY "date" DESC LIMIT 1),
  CURRENT_DATE
)
WHERE "currentBusinessDate" IS NULL;
