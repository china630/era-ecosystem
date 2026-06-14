-- Dynamic Rate Plans & Add-ons: BAR calendar, derived rates, add-on catalog
CREATE TYPE "RatePlanType" AS ENUM ('BASE', 'DERIVED');

CREATE TYPE "RateAdjustmentMode" AS ENUM ('PERCENT', 'FIXED');

CREATE TYPE "AddOnPricingUnit" AS ENUM ('PER_STAY', 'PER_NIGHT', 'PER_GUEST', 'PER_GUEST_NIGHT');

CREATE TYPE "AddOnInclusion" AS ENUM ('INCLUDED', 'OPTIONAL');

ALTER TABLE "RatePlan" ADD COLUMN "type" "RatePlanType" NOT NULL DEFAULT 'DERIVED';
ALTER TABLE "RatePlan" ADD COLUMN "derivedFromId" TEXT;
ALTER TABLE "RatePlan" ADD COLUMN "adjustmentMode" "RateAdjustmentMode";
ALTER TABLE "RatePlan" ADD COLUMN "adjustmentValue" DECIMAL(12,4);
ALTER TABLE "RatePlan" ADD COLUMN "roomRevenueCodeId" TEXT;
ALTER TABLE "RatePlan" ADD COLUMN "isRefundable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RatePlan" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RatePlan" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "RatePlan" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_derivedFromId_fkey"
  FOREIGN KEY ("derivedFromId") REFERENCES "RatePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_roomRevenueCodeId_fkey"
  FOREIGN KEY ("roomRevenueCodeId") REFERENCES "RevenueCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RoomTypeRate" (
    "id" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'AZN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomTypeRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomTypeRate_ratePlanId_roomTypeId_date_key" ON "RoomTypeRate"("ratePlanId", "roomTypeId", "date");
CREATE INDEX "RoomTypeRate_roomTypeId_date_idx" ON "RoomTypeRate"("roomTypeId", "date");

ALTER TABLE "RoomTypeRate" ADD CONSTRAINT "RoomTypeRate_ratePlanId_fkey"
  FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomTypeRate" ADD CONSTRAINT "RoomTypeRate_roomTypeId_fkey"
  FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AddOn" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "pricingUnit" "AddOnPricingUnit" NOT NULL DEFAULT 'PER_GUEST_NIGHT',
    "revenueCodeId" TEXT NOT NULL,
    "taxTag" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AddOn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AddOn_code_key" ON "AddOn"("code");

ALTER TABLE "AddOn" ADD CONSTRAINT "AddOn_revenueCodeId_fkey"
  FOREIGN KEY ("revenueCodeId") REFERENCES "RevenueCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "RatePlanAddOn" (
    "id" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "inclusion" "AddOnInclusion" NOT NULL DEFAULT 'OPTIONAL',
    "overridePrice" DECIMAL(12,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RatePlanAddOn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RatePlanAddOn_ratePlanId_addOnId_key" ON "RatePlanAddOn"("ratePlanId", "addOnId");
CREATE INDEX "RatePlanAddOn_ratePlanId_idx" ON "RatePlanAddOn"("ratePlanId");

ALTER TABLE "RatePlanAddOn" ADD CONSTRAINT "RatePlanAddOn_ratePlanId_fkey"
  FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RatePlanAddOn" ADD CONSTRAINT "RatePlanAddOn_addOnId_fkey"
  FOREIGN KEY ("addOnId") REFERENCES "AddOn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
