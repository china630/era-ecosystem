-- Stay FO business-day attribution (ADR hotel-fo-business-day-checkin-out).
-- actualCheckIn/Out stay wall-clock; stamps = open business day at the button.

ALTER TABLE "Stay" ADD COLUMN "checkInBusinessDate" TIMESTAMP(3);
ALTER TABLE "Stay" ADD COLUMN "checkOutBusinessDate" TIMESTAMP(3);

-- Backfill: Asia/Baku civil day of naive-UTC wall actual* → UTC-midnight date stamp.
UPDATE "Stay"
SET "checkInBusinessDate" = ((("actualCheckIn" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Baku')::date)::timestamp;

UPDATE "Stay"
SET "checkOutBusinessDate" = ((("actualCheckOut" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Baku')::date)::timestamp
WHERE "actualCheckOut" IS NOT NULL;

ALTER TABLE "Stay" ALTER COLUMN "checkInBusinessDate" SET NOT NULL;

CREATE INDEX "Stay_organizationId_checkInBusinessDate_idx" ON "Stay"("organizationId", "checkInBusinessDate");
CREATE INDEX "Stay_organizationId_checkOutBusinessDate_idx" ON "Stay"("organizationId", "checkOutBusinessDate");
