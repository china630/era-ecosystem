-- Wave D2: Guest details, loyalty/time-share, notes/tasks, reservation sub-modals

ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "visaType" TEXT;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "visaNumber" TEXT;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "visaExpiry" TIMESTAMP(3);
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "maritalStatus" TEXT;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "fatherName" TEXT;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "motherName" TEXT;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "verificationStatus" TEXT;

CREATE TABLE IF NOT EXISTS "GuestLoyaltyCard" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "tier" TEXT,
    "points" DECIMAL(12,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestLoyaltyCard_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GuestLoyaltyCard_guestId_idx" ON "GuestLoyaltyCard"("guestId");
ALTER TABLE "GuestLoyaltyCard" DROP CONSTRAINT IF EXISTS "GuestLoyaltyCard_guestId_fkey";
ALTER TABLE "GuestLoyaltyCard" ADD CONSTRAINT "GuestLoyaltyCard_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "GuestTimeShareAgreement" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "contractNo" TEXT NOT NULL,
    "unitCode" TEXT,
    "weekNo" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "validFrom" DATE,
    "validTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestTimeShareAgreement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GuestTimeShareAgreement_guestId_idx" ON "GuestTimeShareAgreement"("guestId");
ALTER TABLE "GuestTimeShareAgreement" DROP CONSTRAINT IF EXISTS "GuestTimeShareAgreement_guestId_fkey";
ALTER TABLE "GuestTimeShareAgreement" ADD CONSTRAINT "GuestTimeShareAgreement_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "GuestNote" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "noteType" TEXT NOT NULL DEFAULT 'GENERAL',
    "text" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GuestNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GuestNote_guestId_idx" ON "GuestNote"("guestId");
ALTER TABLE "GuestNote" DROP CONSTRAINT IF EXISTS "GuestNote_guestId_fkey";
ALTER TABLE "GuestNote" ADD CONSTRAINT "GuestNote_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "GuestTask" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GuestTask_guestId_idx" ON "GuestTask"("guestId");
ALTER TABLE "GuestTask" DROP CONSTRAINT IF EXISTS "GuestTask_guestId_fkey";
ALTER TABLE "GuestTask" ADD CONSTRAINT "GuestTask_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ReservationPaymentCard" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "cardBrand" TEXT,
    "lastFour" TEXT NOT NULL,
    "expiryMonth" INTEGER,
    "expiryYear" INTEGER,
    "holderName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReservationPaymentCard_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ReservationPaymentCard_reservationId_idx" ON "ReservationPaymentCard"("reservationId");
ALTER TABLE "ReservationPaymentCard" DROP CONSTRAINT IF EXISTS "ReservationPaymentCard_reservationId_fkey";
ALTER TABLE "ReservationPaymentCard" ADD CONSTRAINT "ReservationPaymentCard_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ReservationPackageLine" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "packageCode" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReservationPackageLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ReservationPackageLine_reservationId_idx" ON "ReservationPackageLine"("reservationId");
ALTER TABLE "ReservationPackageLine" DROP CONSTRAINT IF EXISTS "ReservationPackageLine_reservationId_fkey";
ALTER TABLE "ReservationPackageLine" ADD CONSTRAINT "ReservationPackageLine_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ReservationTask" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReservationTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ReservationTask_reservationId_idx" ON "ReservationTask"("reservationId");
ALTER TABLE "ReservationTask" DROP CONSTRAINT IF EXISTS "ReservationTask_reservationId_fkey";
ALTER TABLE "ReservationTask" ADD CONSTRAINT "ReservationTask_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
