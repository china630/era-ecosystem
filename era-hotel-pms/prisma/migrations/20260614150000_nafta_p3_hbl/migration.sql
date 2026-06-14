-- Nafta P3 H-BL-20..28 schema

ALTER TABLE "FiscalDocument" ADD COLUMN IF NOT EXISTS "eqaimeId" TEXT;
ALTER TABLE "FiscalDocument" ADD COLUMN IF NOT EXISTS "eqaimeStatus" TEXT;

CREATE TYPE "ConciergeProductCategory" AS ENUM ('EXCURSION', 'TICKET', 'RESTAURANT_EXT');
CREATE TYPE "ConciergeOrderStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "DispatchRequestStatus" AS ENUM ('QUEUED', 'ASSIGNED', 'IN_PROGRESS', 'DONE', 'CANCELLED');

CREATE TABLE IF NOT EXISTS "GuestCrmExtension" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "interestsJson" TEXT,
    "socialMediaJson" TEXT,
    "generalCrmNotes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GuestCrmExtension_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GuestCrmExtension_guestId_key" ON "GuestCrmExtension"("guestId");
ALTER TABLE "GuestCrmExtension" ADD CONSTRAINT "GuestCrmExtension_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ConciergeProduct" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ConciergeProductCategory" NOT NULL DEFAULT 'EXCURSION',
    "supplierName" TEXT,
    "commissionPct" DECIMAL(5,2),
    "price" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConciergeProduct_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ConciergeProduct_code_key" ON "ConciergeProduct"("code");

CREATE TABLE IF NOT EXISTS "ConciergeOrder" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "reservationId" TEXT,
    "productId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "status" "ConciergeOrderStatus" NOT NULL DEFAULT 'REQUESTED',
    "folioChargeId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConciergeOrder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ConciergeOrder_guestId_idx" ON "ConciergeOrder"("guestId");
CREATE INDEX IF NOT EXISTS "ConciergeOrder_status_idx" ON "ConciergeOrder"("status");
ALTER TABLE "ConciergeOrder" ADD CONSTRAINT "ConciergeOrder_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConciergeOrder" ADD CONSTRAINT "ConciergeOrder_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConciergeOrder" ADD CONSTRAINT "ConciergeOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ConciergeProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "MinibarEvent" (
    "id" TEXT NOT NULL,
    "roomId" TEXT,
    "roomNumber" TEXT,
    "sensorId" TEXT,
    "itemCode" TEXT,
    "deltaQty" INTEGER NOT NULL DEFAULT -1,
    "rawPayloadJson" TEXT,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "postingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MinibarEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MinibarEvent_roomNumber_idx" ON "MinibarEvent"("roomNumber");
CREATE INDEX IF NOT EXISTS "MinibarEvent_reconciled_idx" ON "MinibarEvent"("reconciled");

CREATE TABLE IF NOT EXISTS "DispatchVehicle" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DispatchVehicle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DispatchVehicle_code_key" ON "DispatchVehicle"("code");

CREATE TABLE IF NOT EXISTS "DispatchRequest" (
    "id" TEXT NOT NULL,
    "guestId" TEXT,
    "fromLabel" TEXT NOT NULL,
    "toLabel" TEXT NOT NULL,
    "vehicleId" TEXT,
    "status" "DispatchRequestStatus" NOT NULL DEFAULT 'QUEUED',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DispatchRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DispatchRequest_status_idx" ON "DispatchRequest"("status");
CREATE INDEX IF NOT EXISTS "DispatchRequest_guestId_idx" ON "DispatchRequest"("guestId");
ALTER TABLE "DispatchRequest" ADD CONSTRAINT "DispatchRequest_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DispatchRequest" ADD CONSTRAINT "DispatchRequest_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "DispatchVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MigrationRegistration" ADD COLUMN IF NOT EXISTS "externalRef" TEXT;
ALTER TABLE "MigrationRegistration" ADD COLUMN IF NOT EXISTS "registryResponseJson" TEXT;
