-- Resource sex, clinic week hours, bath modes, and occupancy cleanup.

CREATE TYPE "ResourceSexAudience" AS ENUM ('MALE', 'FEMALE', 'ANY');

ALTER TABLE "Resource" ADD COLUMN "sex_audience" "ResourceSexAudience" NOT NULL DEFAULT 'ANY';

UPDATE "Resource"
SET "sex_audience" = 'FEMALE'
WHERE code IN ('WO-ROOM-11', 'WO-ROOM-12', 'WO-ROOM-13', 'WO-ROOM-14')
   OR name ILIKE '%qadın%'
   OR name ILIKE '%qadin%';

UPDATE "Resource"
SET "sex_audience" = 'MALE'
WHERE "sex_audience" = 'ANY'
  AND (
    code IN ('WO-ROOM-15', 'WO-ROOM-16', 'WO-ROOM-17', 'WO-ROOM-18')
    OR name ILIKE '%kişi%'
    OR name ILIKE '%kisi%'
  );

ALTER TABLE "Tenant" ADD COLUMN "saturday_end_hour" INTEGER NOT NULL DEFAULT 13;
ALTER TABLE "Tenant" ADD COLUMN "shortened_day_end_hour" INTEGER NOT NULL DEFAULT 13;
ALTER TABLE "Tenant" ADD COLUMN "bath_day_modes_json" TEXT;

-- CANCELLED frees the cabin. NO_SHOW keeps its booking as proof.
DELETE FROM "procedure_allocation"
WHERE "procedure_order_id" IN (
  SELECT id FROM "ProcedureOrder" WHERE status = 'CANCELLED'
);

DELETE FROM "ResourceBooking"
WHERE "procedureOrderId" IN (
  SELECT id FROM "ProcedureOrder" WHERE status = 'CANCELLED'
);

-- Snap stored procedure clocks onto the 5-minute grid.
UPDATE "ProcedureOrder"
SET "scheduledAt" = date_trunc('hour', "scheduledAt")
  + make_interval(mins => (round(EXTRACT(minute FROM "scheduledAt") / 5.0) * 5)::int)
WHERE EXTRACT(minute FROM "scheduledAt")::int % 5 <> 0
   OR EXTRACT(second FROM "scheduledAt") <> 0;

UPDATE "ProcedureOrder"
SET "endsAt" = date_trunc('hour', "endsAt")
  + make_interval(mins => (round(EXTRACT(minute FROM "endsAt") / 5.0) * 5)::int)
WHERE "endsAt" IS NOT NULL
  AND (
    EXTRACT(minute FROM "endsAt")::int % 5 <> 0
    OR EXTRACT(second FROM "endsAt") <> 0
  );

UPDATE "procedure_allocation"
SET "starts_at" = date_trunc('hour', "starts_at")
  + make_interval(mins => (round(EXTRACT(minute FROM "starts_at") / 5.0) * 5)::int)
WHERE EXTRACT(minute FROM "starts_at")::int % 5 <> 0
   OR EXTRACT(second FROM "starts_at") <> 0;

UPDATE "procedure_allocation"
SET "ends_at" = date_trunc('hour', "ends_at")
  + make_interval(mins => (round(EXTRACT(minute FROM "ends_at") / 5.0) * 5)::int)
WHERE EXTRACT(minute FROM "ends_at")::int % 5 <> 0
   OR EXTRACT(second FROM "ends_at") <> 0;

UPDATE "ResourceBooking"
SET "startsAt" = date_trunc('hour', "startsAt")
  + make_interval(mins => (round(EXTRACT(minute FROM "startsAt") / 5.0) * 5)::int)
WHERE EXTRACT(minute FROM "startsAt")::int % 5 <> 0
   OR EXTRACT(second FROM "startsAt") <> 0;

UPDATE "ResourceBooking"
SET "endsAt" = date_trunc('hour', "endsAt")
  + make_interval(mins => (round(EXTRACT(minute FROM "endsAt") / 5.0) * 5)::int)
WHERE EXTRACT(minute FROM "endsAt")::int % 5 <> 0
   OR EXTRACT(second FROM "endsAt") <> 0;
