-- CreateEnum
CREATE TYPE "HotelSellablePackageFamily" AS ENUM ('MEDICAL', 'INFOTUR');

-- CreateTable
CREATE TABLE "HotelSellablePackage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" "HotelSellablePackageFamily" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ratePlanId" TEXT,
    "minNights" INTEGER,
    "maxNights" INTEGER,
    "durationDays" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelSellablePackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HotelSellablePackage_organizationId_family_active_idx" ON "HotelSellablePackage"("organizationId", "family", "active");

-- CreateIndex
CREATE INDEX "HotelSellablePackage_ratePlanId_idx" ON "HotelSellablePackage"("ratePlanId");

-- CreateIndex
CREATE UNIQUE INDEX "HotelSellablePackage_organizationId_code_key" ON "HotelSellablePackage"("organizationId", "code");

-- AddForeignKey
ALTER TABLE "HotelSellablePackage" ADD CONSTRAINT "HotelSellablePackage_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
