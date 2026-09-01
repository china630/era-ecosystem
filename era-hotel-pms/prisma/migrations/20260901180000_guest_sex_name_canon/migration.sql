-- ReservationGuest pax middle name; Guest sex/parent columns keep physical names via @map.

ALTER TABLE "ReservationGuest"
  ADD COLUMN IF NOT EXISTS "middleName" TEXT;
