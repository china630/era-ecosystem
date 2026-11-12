-- Guest phone link (desk QR / 6-digit) and device session.
CREATE TABLE "GuestAppLinkChallenge" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "reservationGuestId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestAppLinkChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuestAppDeviceSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "reservationGuestId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestAppDeviceSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GuestAppLinkChallenge_organizationId_codeHash_idx" ON "GuestAppLinkChallenge"("organizationId", "codeHash");
CREATE INDEX "GuestAppLinkChallenge_reservationGuestId_idx" ON "GuestAppLinkChallenge"("reservationGuestId");
CREATE INDEX "GuestAppLinkChallenge_organizationId_idx" ON "GuestAppLinkChallenge"("organizationId");
CREATE UNIQUE INDEX "GuestAppDeviceSession_tokenHash_key" ON "GuestAppDeviceSession"("tokenHash");
CREATE INDEX "GuestAppDeviceSession_reservationGuestId_idx" ON "GuestAppDeviceSession"("reservationGuestId");
CREATE INDEX "GuestAppDeviceSession_organizationId_idx" ON "GuestAppDeviceSession"("organizationId");

ALTER TABLE "GuestAppLinkChallenge" ADD CONSTRAINT "GuestAppLinkChallenge_reservationGuestId_fkey" FOREIGN KEY ("reservationGuestId") REFERENCES "ReservationGuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestAppDeviceSession" ADD CONSTRAINT "GuestAppDeviceSession_reservationGuestId_fkey" FOREIGN KEY ("reservationGuestId") REFERENCES "ReservationGuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
