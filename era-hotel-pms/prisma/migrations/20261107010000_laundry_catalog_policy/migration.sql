-- Laundry catalog: localized names + nullable wash/iron + express prices
ALTER TABLE "LaundryItem" ADD COLUMN IF NOT EXISTS "nameAz" TEXT;
ALTER TABLE "LaundryItem" ADD COLUMN IF NOT EXISTS "nameRu" TEXT;
ALTER TABLE "LaundryItem" ADD COLUMN IF NOT EXISTS "nameEn" TEXT;
ALTER TABLE "LaundryItem" ADD COLUMN IF NOT EXISTS "expressWashPrice" DECIMAL(12,2);
ALTER TABLE "LaundryItem" ADD COLUMN IF NOT EXISTS "expressIronPrice" DECIMAL(12,2);

UPDATE "LaundryItem" SET "nameEn" = "name" WHERE "nameEn" IS NULL OR "nameEn" = '';
UPDATE "LaundryItem" SET "nameAz" = "name" WHERE "nameAz" IS NULL OR "nameAz" = '';
UPDATE "LaundryItem" SET "nameRu" = "name" WHERE "nameRu" IS NULL OR "nameRu" = '';

ALTER TABLE "LaundryItem" ALTER COLUMN "washPrice" DROP DEFAULT;
ALTER TABLE "LaundryItem" ALTER COLUMN "ironPrice" DROP DEFAULT;
UPDATE "LaundryItem" SET "washPrice" = NULL WHERE "washPrice" = 0;
UPDATE "LaundryItem" SET "ironPrice" = NULL WHERE "ironPrice" = 0;
ALTER TABLE "LaundryItem" ALTER COLUMN "washPrice" DROP NOT NULL;
ALTER TABLE "LaundryItem" ALTER COLUMN "ironPrice" DROP NOT NULL;

-- Intake / due policy on HkHotelPolicy (WINDOW 09–17 = prior hardcoded Nafta hours)
ALTER TABLE "HkHotelPolicy" ADD COLUMN IF NOT EXISTS "laundryIntakeMode" TEXT NOT NULL DEFAULT 'WINDOW';
ALTER TABLE "HkHotelPolicy" ADD COLUMN IF NOT EXISTS "laundryIntakeStartHour" INTEGER DEFAULT 9;
ALTER TABLE "HkHotelPolicy" ADD COLUMN IF NOT EXISTS "laundryIntakeEndHour" INTEGER DEFAULT 17;
ALTER TABLE "HkHotelPolicy" ADD COLUMN IF NOT EXISTS "laundryClosedDays" TEXT NOT NULL DEFAULT 'EXCEPT_SUNDAY_AND_CALENDAR';
ALTER TABLE "HkHotelPolicy" ADD COLUMN IF NOT EXISTS "laundryDueMode" TEXT NOT NULL DEFAULT 'BY_HOUR';
ALTER TABLE "HkHotelPolicy" ADD COLUMN IF NOT EXISTS "laundryDueCutoffHour" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "HkHotelPolicy" ADD COLUMN IF NOT EXISTS "laundryDueAtHour" INTEGER NOT NULL DEFAULT 17;

-- If columns already existed from an earlier draft of this migration (ANY + null hours), restore Nafta windows.
UPDATE "HkHotelPolicy"
SET
  "laundryIntakeMode" = 'WINDOW',
  "laundryIntakeStartHour" = COALESCE("laundryIntakeStartHour", 9),
  "laundryIntakeEndHour" = COALESCE("laundryIntakeEndHour", 17)
WHERE "laundryIntakeMode" = 'ANY'
  AND "laundryIntakeStartHour" IS NULL
  AND "laundryIntakeEndHour" IS NULL;
