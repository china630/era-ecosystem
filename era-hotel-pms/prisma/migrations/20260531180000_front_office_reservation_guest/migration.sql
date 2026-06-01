-- CreateEnum
CREATE TYPE "ReservationNoteType" AS ENUM ('EXTRA_REQ', 'RES_NOTE', 'CIN_NOTE', 'COUT_NOTE', 'ROOM_NOTE', 'CANCEL_NOTE', 'PAYMENT_NOTE', 'PRICE_NOTE', 'INVOICE_NOTE', 'CONFIRMATION', 'GENERAL_NOTE', 'ARRIVAL_POSTPONED', 'DEPARTURE_EXTENDED', 'SET_ARRIVAL_EARLY', 'SET_DEPARTURE_EARLY');

-- CreateTable
CREATE TABLE "ReservationGroup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "agencyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationGuest" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "title" TEXT,
    "gender" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "nationality" TEXT,
    "birthDate" TIMESTAMP(3),
    "age" INTEGER,
    "idCardNo" TEXT,
    "passportNo" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReservationGuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationNote" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "noteType" "ReservationNoteType" NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ReservationNote_pkey" PRIMARY KEY ("id")
);

-- AlterTable Guest
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "middleName" TEXT;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "gender" TEXT;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "vipType" TEXT;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "birthPlace" TEXT;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "occupation" TEXT;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "registrationNumber" TEXT;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "vehiclePlate" TEXT;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "greyList" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "problematic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "hotelName" TEXT;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "visitCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "gdprConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "smsConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "whatsappConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "phoneConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "emailConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "callBack" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable Reservation
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "voucherNo" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "roomCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "adults" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "children11_6" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "children5_2" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "children1_0" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "market" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "segment" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "rateType" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "booker" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "guestRep" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "paidBy" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "vipType" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "accomType" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "recordType" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "specialStates" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "tripReason" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "resGroup" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "colorCode" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "resNo" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "shareNo" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "optionDate" TIMESTAMP(3);
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "optionState" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "salesProject" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "useManualRate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "manualDailyRate" DECIMAL(12,2);
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "discountActive" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "ReservationGroup_code_key" ON "ReservationGroup"("code");
CREATE INDEX "ReservationGuest_reservationId_idx" ON "ReservationGuest"("reservationId");
CREATE UNIQUE INDEX "ReservationNote_reservationId_noteType_key" ON "ReservationNote"("reservationId", "noteType");
CREATE INDEX "ReservationNote_reservationId_idx" ON "ReservationNote"("reservationId");
CREATE INDEX "Reservation_groupId_idx" ON "Reservation"("groupId");

-- AddForeignKey
ALTER TABLE "ReservationGroup" ADD CONSTRAINT "ReservationGroup_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ReservationGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReservationGuest" ADD CONSTRAINT "ReservationGuest_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReservationNote" ADD CONSTRAINT "ReservationNote_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
