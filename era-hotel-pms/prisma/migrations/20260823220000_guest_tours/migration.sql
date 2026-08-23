-- Guest group tours + folio payment allocation (HOT-TOUR-01)

CREATE TYPE "TourDepartureStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'DEPARTED', 'CANCELLED');
CREATE TYPE "TourBookingStatus" AS ENUM ('CHARGED', 'PAID', 'CANCELLED', 'ON_CITY_LEDGER');

CREATE TABLE "FolioPaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "FolioPaymentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FolioPaymentAllocation_paymentId_chargeId_key" ON "FolioPaymentAllocation"("paymentId", "chargeId");
CREATE INDEX "FolioPaymentAllocation_chargeId_idx" ON "FolioPaymentAllocation"("chargeId");

ALTER TABLE "FolioPaymentAllocation" ADD CONSTRAINT "FolioPaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "FolioPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FolioPaymentAllocation" ADD CONSTRAINT "FolioPaymentAllocation_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "FolioCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TourTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultAgenda" TEXT NOT NULL DEFAULT '',
    "defaultPickup" TEXT,
    "defaultReturn" TEXT,
    "defaultCapacity" INTEGER NOT NULL DEFAULT 20,
    "defaultPrice" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TourTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TourTemplate_organizationId_code_key" ON "TourTemplate"("organizationId", "code");
CREATE INDEX "TourTemplate_organizationId_idx" ON "TourTemplate"("organizationId");

CREATE TABLE "TourDeparture" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateId" TEXT,
    "date" DATE NOT NULL,
    "pickupAt" TIMESTAMP(3) NOT NULL,
    "returnAt" TIMESTAMP(3) NOT NULL,
    "agenda" TEXT NOT NULL DEFAULT '',
    "meetingPoint" TEXT NOT NULL DEFAULT '',
    "guideName" TEXT,
    "vehicleId" TEXT,
    "capacity" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "status" "TourDepartureStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TourDeparture_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TourDeparture_organizationId_date_idx" ON "TourDeparture"("organizationId", "date");
CREATE INDEX "TourDeparture_vehicleId_idx" ON "TourDeparture"("vehicleId");
CREATE INDEX "TourDeparture_status_idx" ON "TourDeparture"("status");

ALTER TABLE "TourDeparture" ADD CONSTRAINT "TourDeparture_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TourTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TourDeparture" ADD CONSTRAINT "TourDeparture_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "TransferVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TourBooking" (
    "id" TEXT NOT NULL,
    "departureId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "guestId" TEXT,
    "folioChargeId" TEXT,
    "folioPaymentId" TEXT,
    "status" "TourBookingStatus" NOT NULL DEFAULT 'CHARGED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TourBooking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TourBooking_departureId_reservationId_key" ON "TourBooking"("departureId", "reservationId");
CREATE INDEX "TourBooking_reservationId_idx" ON "TourBooking"("reservationId");
CREATE INDEX "TourBooking_status_idx" ON "TourBooking"("status");

ALTER TABLE "TourBooking" ADD CONSTRAINT "TourBooking_departureId_fkey" FOREIGN KEY ("departureId") REFERENCES "TourDeparture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TourBooking" ADD CONSTRAINT "TourBooking_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TourBooking" ADD CONSTRAINT "TourBooking_folioChargeId_fkey" FOREIGN KEY ("folioChargeId") REFERENCES "FolioCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
