-- Walk-in profile is a hotel lookup. Stay slices can hold the door for their own nights.
ALTER TYPE "HotelLookupKind" ADD VALUE IF NOT EXISTS 'WALKIN_PROFILE';

ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "walkInProfileCode" TEXT;

ALTER TABLE "ReservationStaySlice" ADD COLUMN IF NOT EXISTS "roomId" TEXT;

CREATE INDEX IF NOT EXISTS "ReservationStaySlice_roomId_idx" ON "ReservationStaySlice"("roomId");

DO $$ BEGIN
  ALTER TABLE "ReservationStaySlice"
    ADD CONSTRAINT "ReservationStaySlice_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
