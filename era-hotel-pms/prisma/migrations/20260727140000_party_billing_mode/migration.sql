-- Party billing (PRIMARY vs EQUAL peers) + personal GUEST folio link

CREATE TYPE "PartyBillingMode" AS ENUM ('PRIMARY', 'EQUAL');

ALTER TABLE "Reservation" ADD COLUMN "partyBillingMode" "PartyBillingMode" NOT NULL DEFAULT 'PRIMARY';

ALTER TABLE "ReservationGuest" ADD COLUMN "guestId" TEXT;
ALTER TABLE "ReservationGuest" ADD COLUMN "ownsFolio" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Folio" ADD COLUMN "reservationGuestId" TEXT;

CREATE UNIQUE INDEX "Folio_reservationGuestId_key" ON "Folio"("reservationGuestId");

CREATE INDEX "ReservationGuest_guestId_idx" ON "ReservationGuest"("guestId");

ALTER TABLE "ReservationGuest" ADD CONSTRAINT "ReservationGuest_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Folio" ADD CONSTRAINT "Folio_reservationGuestId_fkey" FOREIGN KEY ("reservationGuestId") REFERENCES "ReservationGuest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
