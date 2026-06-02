-- Wave F: guest CSV fields, loyalty points, document columns

ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "marriageDate" DATE;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "bonusPercent" DECIMAL(5,2);
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "GuestDocument" ADD COLUMN IF NOT EXISTS "serialNo" TEXT;
ALTER TABLE "GuestDocument" ADD COLUMN IF NOT EXISTS "issuingAuthority" TEXT;
ALTER TABLE "GuestDocument" ADD COLUMN IF NOT EXISTS "nationality" TEXT;
ALTER TABLE "GuestDocument" ADD COLUMN IF NOT EXISTS "issuePlace" TEXT;
ALTER TABLE "GuestDocument" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "GuestLoyaltyPointEntry" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "points" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "balanceAfter" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestLoyaltyPointEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GuestLoyaltyPointEntry_guestId_idx" ON "GuestLoyaltyPointEntry"("guestId");
CREATE INDEX IF NOT EXISTS "GuestLoyaltyPointEntry_entryDate_idx" ON "GuestLoyaltyPointEntry"("entryDate");
ALTER TABLE "GuestLoyaltyPointEntry" ADD CONSTRAINT "GuestLoyaltyPointEntry_guestId_fkey"
  FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
