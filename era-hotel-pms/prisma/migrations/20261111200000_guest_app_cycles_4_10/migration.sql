-- Guest app cycles 4-10 (booking request, stay orders, family grant, OTP)

CREATE TYPE "GuestBookingRequestStatus" AS ENUM ('REQUESTED', 'ANSWERED', 'CANCELLED');
CREATE TYPE "GuestStayOrderKind" AS ENUM ('HOUSEKEEPING', 'DND', 'TOWELS', 'WATER', 'MINIBAR', 'WAKEUP', 'LATE_CHECKOUT', 'ARRIVAL_TIME');
CREATE TYPE "GuestStayOrderStatus" AS ENUM ('QUEUED', 'REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "GuestAppOtpChannel" AS ENUM ('SMS', 'WHATSAPP', 'EMAIL');

CREATE TABLE "GuestBookingRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "checkInDate" TIMESTAMP(3) NOT NULL,
  "checkOutDate" TIMESTAMP(3) NOT NULL,
  "adults" INTEGER NOT NULL DEFAULT 1,
  "children" INTEGER NOT NULL DEFAULT 0,
  "packageNote" TEXT,
  "contactPhone" TEXT,
  "contactName" TEXT,
  "status" "GuestBookingRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "reservationId" TEXT,
  "createdByTokenHash" TEXT,
  "staffNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuestBookingRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GuestBookingRequest_organizationId_status_idx" ON "GuestBookingRequest"("organizationId", "status");
CREATE INDEX "GuestBookingRequest_reservationId_idx" ON "GuestBookingRequest"("reservationId");
CREATE INDEX "GuestBookingRequest_organizationId_idx" ON "GuestBookingRequest"("organizationId");
ALTER TABLE "GuestBookingRequest" ADD CONSTRAINT "GuestBookingRequest_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "GuestStayOrder" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "reservationGuestId" TEXT NOT NULL,
  "kind" "GuestStayOrderKind" NOT NULL,
  "status" "GuestStayOrderStatus" NOT NULL DEFAULT 'REQUESTED',
  "note" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuestStayOrder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GuestStayOrder_organizationId_status_idx" ON "GuestStayOrder"("organizationId", "status");
CREATE INDEX "GuestStayOrder_reservationId_idx" ON "GuestStayOrder"("reservationId");
CREATE INDEX "GuestStayOrder_reservationGuestId_idx" ON "GuestStayOrder"("reservationGuestId");
CREATE INDEX "GuestStayOrder_organizationId_idx" ON "GuestStayOrder"("organizationId");
ALTER TABLE "GuestStayOrder" ADD CONSTRAINT "GuestStayOrder_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestStayOrder" ADD CONSTRAINT "GuestStayOrder_reservationGuestId_fkey" FOREIGN KEY ("reservationGuestId") REFERENCES "ReservationGuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GuestFamilyGrant" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "grantorGuestId" TEXT NOT NULL,
  "granteeGuestId" TEXT NOT NULL,
  "deskConfirmedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestFamilyGrant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuestFamilyGrant_reservationId_grantorGuestId_granteeGuestId_key" ON "GuestFamilyGrant"("reservationId", "grantorGuestId", "granteeGuestId");
CREATE INDEX "GuestFamilyGrant_organizationId_idx" ON "GuestFamilyGrant"("organizationId");
CREATE INDEX "GuestFamilyGrant_reservationId_idx" ON "GuestFamilyGrant"("reservationId");
ALTER TABLE "GuestFamilyGrant" ADD CONSTRAINT "GuestFamilyGrant_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestFamilyGrant" ADD CONSTRAINT "GuestFamilyGrant_grantorGuestId_fkey" FOREIGN KEY ("grantorGuestId") REFERENCES "ReservationGuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestFamilyGrant" ADD CONSTRAINT "GuestFamilyGrant_granteeGuestId_fkey" FOREIGN KEY ("granteeGuestId") REFERENCES "ReservationGuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GuestAppOtpChallenge" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "channel" "GuestAppOtpChannel" NOT NULL,
  "destination" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestAppOtpChallenge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GuestAppOtpChallenge_organizationId_destination_codeHash_idx" ON "GuestAppOtpChallenge"("organizationId", "destination", "codeHash");
CREATE INDEX "GuestAppOtpChallenge_organizationId_idx" ON "GuestAppOtpChallenge"("organizationId");
