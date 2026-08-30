-- Nafta Wave A: per-pax / reservation medical package SKU (notes+agency resolve; not EW rate).
ALTER TABLE "ReservationGuest" ADD COLUMN IF NOT EXISTS "medicalPackageCode" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "medicalPackageCode" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "medicalPackageUnresolved" BOOLEAN NOT NULL DEFAULT true;
