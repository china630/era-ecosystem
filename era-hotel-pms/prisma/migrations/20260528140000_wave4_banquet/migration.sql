-- Wave 4: HN-8 Banquet BEO

ALTER TYPE "PosResourceType" ADD VALUE 'BANQUET_HALL';

CREATE TYPE "BanquetEventStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'DONE', 'CANCELLED');

CREATE TABLE "BanquetSaloon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxPax" INTEGER NOT NULL DEFAULT 100,
    "posResourceId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BanquetSaloon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BanquetMenuPackage" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricePerPax" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BanquetMenuPackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BanquetEvent" (
    "id" TEXT NOT NULL,
    "referenceNo" TEXT,
    "eventName" TEXT NOT NULL,
    "saloonId" TEXT NOT NULL,
    "menuPackageId" TEXT,
    "reservationId" TEXT,
    "eventDate" DATE NOT NULL,
    "pax" INTEGER NOT NULL,
    "advanceAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "BanquetEventStatus" NOT NULL DEFAULT 'DRAFT',
    "contactName" TEXT,
    "notes" TEXT,
    "posReservationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BanquetEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BanquetSaloon_code_key" ON "BanquetSaloon"("code");
CREATE UNIQUE INDEX "BanquetSaloon_posResourceId_key" ON "BanquetSaloon"("posResourceId");
CREATE UNIQUE INDEX "BanquetMenuPackage_code_key" ON "BanquetMenuPackage"("code");
CREATE INDEX "BanquetEvent_saloonId_eventDate_idx" ON "BanquetEvent"("saloonId", "eventDate");
CREATE INDEX "BanquetEvent_status_idx" ON "BanquetEvent"("status");
CREATE INDEX "BanquetEvent_reservationId_idx" ON "BanquetEvent"("reservationId");

ALTER TABLE "BanquetSaloon" ADD CONSTRAINT "BanquetSaloon_posResourceId_fkey" FOREIGN KEY ("posResourceId") REFERENCES "PosResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BanquetEvent" ADD CONSTRAINT "BanquetEvent_saloonId_fkey" FOREIGN KEY ("saloonId") REFERENCES "BanquetSaloon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BanquetEvent" ADD CONSTRAINT "BanquetEvent_menuPackageId_fkey" FOREIGN KEY ("menuPackageId") REFERENCES "BanquetMenuPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BanquetEvent" ADD CONSTRAINT "BanquetEvent_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
