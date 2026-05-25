-- Wave 4: HN-7 airport transfers

CREATE TYPE "TransferDirection" AS ENUM ('IN', 'OUT');
CREATE TYPE "TransferOrderStatus" AS ENUM ('BOOKED', 'CONFIRMED', 'DONE', 'CANCELLED');

CREATE TABLE "TransferVehicle" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "licensePlate" TEXT NOT NULL,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "maxSeats" INTEGER NOT NULL DEFAULT 4,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransferVehicle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransferOrder" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "direction" "TransferDirection" NOT NULL,
    "flightNo" TEXT,
    "pickupAt" TIMESTAMP(3) NOT NULL,
    "vehicleId" TEXT,
    "status" "TransferOrderStatus" NOT NULL DEFAULT 'BOOKED',
    "folioCharged" BOOLEAN NOT NULL DEFAULT false,
    "price" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TransferOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransferVehicle_code_key" ON "TransferVehicle"("code");
CREATE INDEX "TransferOrder_reservationId_idx" ON "TransferOrder"("reservationId");
CREATE INDEX "TransferOrder_pickupAt_idx" ON "TransferOrder"("pickupAt");
CREATE INDEX "TransferOrder_status_idx" ON "TransferOrder"("status");

ALTER TABLE "TransferOrder" ADD CONSTRAINT "TransferOrder_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransferOrder" ADD CONSTRAINT "TransferOrder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "TransferVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
