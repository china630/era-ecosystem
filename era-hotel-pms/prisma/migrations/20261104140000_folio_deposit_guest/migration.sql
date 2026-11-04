-- Deposit belongs to the guest who paid. Party save cannot drop that guest while HELD.
ALTER TABLE "FolioDeposit" ADD COLUMN "reservationGuestId" TEXT;

ALTER TABLE "FolioDeposit"
  ADD CONSTRAINT "FolioDeposit_reservationGuestId_fkey"
  FOREIGN KEY ("reservationGuestId") REFERENCES "ReservationGuest"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "FolioDeposit_reservationGuestId_idx" ON "FolioDeposit"("reservationGuestId");
