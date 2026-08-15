-- Occupancy supplements on rate plans
ALTER TABLE "RatePlan" ADD COLUMN IF NOT EXISTS "baseOccupancy" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "RatePlan" ADD COLUMN IF NOT EXISTS "extraAdultAmount" DECIMAL(12,2);
ALTER TABLE "RatePlan" ADD COLUMN IF NOT EXISTS "thirdAdultAmount" DECIMAL(12,2);
ALTER TABLE "RatePlan" ADD COLUMN IF NOT EXISTS "extraBedAmount" DECIMAL(12,2);

-- Child absolute / free-count bands
ALTER TABLE "ChildPricingMatrix" ADD COLUMN IF NOT EXISTS "amountOverride" DECIMAL(12,2);
ALTER TABLE "ChildPricingMatrix" ADD COLUMN IF NOT EXISTS "freeCount" INTEGER NOT NULL DEFAULT 0;

-- Extra beds on reservation
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "extraBeds" INTEGER NOT NULL DEFAULT 0;

-- Package sell + cost floor versions (independent of BAR)
CREATE TABLE IF NOT EXISTS "RatePlanSellVersion" (
    "id" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "sellPrice" DECIMAL(12,2) NOT NULL,
    "costFloor" DECIMAL(12,2),
    "currencyCode" TEXT NOT NULL DEFAULT 'AZN',
    "occupancy" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RatePlanSellVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RatePlanSellVersion_ratePlanId_occupancy_effectiveFrom_idx"
  ON "RatePlanSellVersion"("ratePlanId", "occupancy", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "RatePlanSellVersion_effectiveFrom_effectiveTo_idx"
  ON "RatePlanSellVersion"("effectiveFrom", "effectiveTo");

DO $$ BEGIN
  ALTER TABLE "RatePlanSellVersion"
    ADD CONSTRAINT "RatePlanSellVersion_ratePlanId_fkey"
    FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
