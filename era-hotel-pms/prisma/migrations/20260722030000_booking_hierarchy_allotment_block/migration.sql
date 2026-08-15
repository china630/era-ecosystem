-- Booking hierarchy: AllotmentBlock + Booking (ReservationGroup) folioMode
-- See docs/adr/hotel-booking-hierarchy.md

CREATE TYPE "AllotmentBlockStatus" AS ENUM ('TENTATIVE', 'DEFINITE', 'CANCELLED', 'RELEASED');
CREATE TYPE "BookingFolioMode" AS ENUM ('INDIVIDUAL', 'MASTER', 'SPLIT');

ALTER TABLE "ReservationGroup" ADD COLUMN IF NOT EXISTS "folioMode" "BookingFolioMode" NOT NULL DEFAULT 'INDIVIDUAL';
ALTER TABLE "ReservationGroup" ADD COLUMN IF NOT EXISTS "allotmentBlockId" TEXT;
ALTER TABLE "ReservationGroup" ADD COLUMN IF NOT EXISTS "checkInDate" TIMESTAMP(3);
ALTER TABLE "ReservationGroup" ADD COLUMN IF NOT EXISTS "checkOutDate" TIMESTAMP(3);
ALTER TABLE "ReservationGroup" ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE TABLE IF NOT EXISTS "AllotmentBlock" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "status" "AllotmentBlockStatus" NOT NULL DEFAULT 'TENTATIVE',
    "agencyId" TEXT,
    "salesContractId" TEXT,
    "validFrom" DATE NOT NULL,
    "validTo" DATE NOT NULL,
    "cutoffDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AllotmentBlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AllotmentBlockLine" (
    "id" TEXT NOT NULL,
    "allotmentBlockId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "ratePlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AllotmentBlockLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AllotmentBlock_code_key" ON "AllotmentBlock"("code");
CREATE INDEX IF NOT EXISTS "AllotmentBlock_agencyId_status_idx" ON "AllotmentBlock"("agencyId", "status");
CREATE INDEX IF NOT EXISTS "AllotmentBlock_validFrom_validTo_idx" ON "AllotmentBlock"("validFrom", "validTo");
CREATE INDEX IF NOT EXISTS "AllotmentBlock_cutoffDate_idx" ON "AllotmentBlock"("cutoffDate");
CREATE INDEX IF NOT EXISTS "AllotmentBlockLine_allotmentBlockId_idx" ON "AllotmentBlockLine"("allotmentBlockId");
CREATE INDEX IF NOT EXISTS "AllotmentBlockLine_roomTypeId_idx" ON "AllotmentBlockLine"("roomTypeId");
CREATE INDEX IF NOT EXISTS "ReservationGroup_allotmentBlockId_idx" ON "ReservationGroup"("allotmentBlockId");
CREATE INDEX IF NOT EXISTS "ReservationGroup_agencyId_idx" ON "ReservationGroup"("agencyId");

DO $$ BEGIN
  ALTER TABLE "AllotmentBlock" ADD CONSTRAINT "AllotmentBlock_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AllotmentBlock" ADD CONSTRAINT "AllotmentBlock_salesContractId_fkey" FOREIGN KEY ("salesContractId") REFERENCES "SalesContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AllotmentBlockLine" ADD CONSTRAINT "AllotmentBlockLine_allotmentBlockId_fkey" FOREIGN KEY ("allotmentBlockId") REFERENCES "AllotmentBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AllotmentBlockLine" ADD CONSTRAINT "AllotmentBlockLine_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AllotmentBlockLine" ADD CONSTRAINT "AllotmentBlockLine_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ReservationGroup" ADD CONSTRAINT "ReservationGroup_allotmentBlockId_fkey" FOREIGN KEY ("allotmentBlockId") REFERENCES "AllotmentBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
