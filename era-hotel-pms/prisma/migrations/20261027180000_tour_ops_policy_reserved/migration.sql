-- Tour booking: seat hold without folio (CHARGE_ON_BOARDING default).
DO $$ BEGIN
  CREATE TYPE "TourChargeMode" AS ENUM ('CHARGE_ON_BOARDING', 'CHARGE_ON_ADD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TourBoardingCloseMode" AS ENUM ('MANUAL', 'AUTO_CUTOFF');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "TourBookingStatus" ADD VALUE 'RESERVED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "TourOpsPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "chargeMode" "TourChargeMode" NOT NULL DEFAULT 'CHARGE_ON_BOARDING',
    "boardingCloseMode" "TourBoardingCloseMode" NOT NULL DEFAULT 'MANUAL',
    "autoCutoffMinutesBeforePickup" INTEGER,
    "allowOverbook" BOOLEAN NOT NULL DEFAULT true,
    "dropUnboardedOnClose" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TourOpsPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TourOpsPolicy_organizationId_key" ON "TourOpsPolicy"("organizationId");

ALTER TABLE "TourBooking" ALTER COLUMN "status" SET DEFAULT 'RESERVED';
