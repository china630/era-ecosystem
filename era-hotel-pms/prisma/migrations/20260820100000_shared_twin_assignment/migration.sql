-- Shared twin assignment fields on Reservation (see docs/adr/hotel-shared-twin-assignment.md)
ALTER TABLE "Reservation" ADD COLUMN "shareEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Reservation" ADD COLUMN "shareGender" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "shareBedIndex" INTEGER;
