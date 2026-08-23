-- Laundry cycle + HK policy tails
ALTER TABLE "LaundryTicket" ADD COLUMN IF NOT EXISTS "dueAt" TIMESTAMP(3);
ALTER TABLE "LaundryTicket" ADD COLUMN IF NOT EXISTS "postedAt" TIMESTAMP(3);
ALTER TABLE "LaundryTicket" ADD COLUMN IF NOT EXISTS "postedByUserId" TEXT;
ALTER TABLE "LaundryTicket" ADD COLUMN IF NOT EXISTS "postedByRole" TEXT;
ALTER TABLE "LaundryTicket" ADD COLUMN IF NOT EXISTS "intakeNote" TEXT;
ALTER TABLE "LaundryTicket" ADD COLUMN IF NOT EXISTS "returnScanKey" TEXT;
UPDATE "LaundryTicket" SET "status" = 'IN_PLANT' WHERE "status" IN ('DRAFT', 'ACCEPTED') AND "folioChargeId" IS NULL;
UPDATE "LaundryTicket" SET "status" = 'POSTED' WHERE "folioChargeId" IS NOT NULL AND "status" <> 'VOIDED';

ALTER TABLE "HkHotelPolicy" ADD COLUMN IF NOT EXISTS "laundryExpressEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HkHotelPolicy" ADD COLUMN IF NOT EXISTS "laundryExpressPercent" INTEGER;
ALTER TABLE "HkHotelPolicy" ADD COLUMN IF NOT EXISTS "egPressureFrom" DATE;

ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "linenEveryNights" INTEGER;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "deepEveryNights" INTEGER;
