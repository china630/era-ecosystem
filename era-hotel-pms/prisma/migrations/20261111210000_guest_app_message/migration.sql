-- Guest phone bell inbox (HOT-GUEST-APP-09)
CREATE TYPE "GuestAppMessageKind" AS ENUM ('RECEPTION', 'CLINIC', 'MARKETING');

CREATE TABLE "GuestAppMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reservationGuestId" TEXT,
    "kind" "GuestAppMessageKind" NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestAppMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GuestAppMessage_organizationId_reservationGuestId_createdAt_idx" ON "GuestAppMessage"("organizationId", "reservationGuestId", "createdAt");
CREATE INDEX "GuestAppMessage_organizationId_kind_idx" ON "GuestAppMessage"("organizationId", "kind");
CREATE INDEX "GuestAppMessage_organizationId_idx" ON "GuestAppMessage"("organizationId");
