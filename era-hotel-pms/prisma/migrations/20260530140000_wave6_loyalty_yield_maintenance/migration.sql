-- Guest loyalty tier (CRM / loyalty integration)
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "loyaltyTier" TEXT;

-- Yield management rules
CREATE TABLE IF NOT EXISTS "YieldRule" (
    "id" TEXT NOT NULL,
    "propertyCode" TEXT NOT NULL,
    "minOccupancyPct" DECIMAL(5,2) NOT NULL,
    "rateAdjustment" DECIMAL(5,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YieldRule_pkey" PRIMARY KEY ("id")
);

-- Maintenance work orders (housekeeping / engineering)
CREATE TABLE IF NOT EXISTS "MaintenanceWorkOrder" (
    "id" TEXT NOT NULL,
    "roomId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reportedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenanceWorkOrder_pkey" PRIMARY KEY ("id")
);

-- User.phone unique (nullable) — idempotent with 20260530120000_user_phone
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone") WHERE "phone" IS NOT NULL;
