-- Stay billing mode (compliment / house use) and tariff-change journal.

CREATE TYPE "StayBillingMode" AS ENUM ('NORMAL', 'COMP', 'HOUSE');

ALTER TABLE "Reservation" ADD COLUMN "billingMode" "StayBillingMode" NOT NULL DEFAULT 'NORMAL';

CREATE TABLE "StayTariffChange" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "fromRatePlanId" TEXT,
    "toRatePlanId" TEXT,
    "fromCode" TEXT,
    "toCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StayTariffChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StayTariffChange_reservationId_effectiveAt_idx" ON "StayTariffChange"("reservationId", "effectiveAt");
CREATE INDEX "StayTariffChange_organizationId_idx" ON "StayTariffChange"("organizationId");

ALTER TABLE "StayTariffChange" ADD CONSTRAINT "StayTariffChange_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
