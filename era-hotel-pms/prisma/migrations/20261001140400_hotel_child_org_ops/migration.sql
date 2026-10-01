-- Hotel child/line organizationId. Backfill from the parent row; fail if any row stays null.

ALTER TABLE "LaundryTicketLine" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "LaundryTicketLine" AS c
SET "organizationId" = p."organizationId"
FROM "LaundryTicket" AS p
WHERE c."ticketId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "LaundryTicketLine" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'LaundryTicketLine: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "LaundryTicketLine" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "LaundryTicketLine_organizationId_idx" ON "LaundryTicketLine"("organizationId");

ALTER TABLE "MinibarPosting" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "MinibarPosting" AS c
SET "organizationId" = p."organizationId"
FROM "Room" AS p
WHERE c."roomId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "MinibarPosting" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'MinibarPosting: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "MinibarPosting" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "MinibarPosting_organizationId_idx" ON "MinibarPosting"("organizationId");
ALTER TABLE "MinibarEvent" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "MinibarEvent" AS c
SET "organizationId" = p."organizationId"
FROM "Room" AS p
WHERE c."roomId" = p.id
  AND c."organizationId" IS NULL;

UPDATE "MinibarEvent" AS e
SET "organizationId" = r."organizationId"
FROM "Room" AS r
WHERE e."organizationId" IS NULL
  AND e."roomNumber" IS NOT NULL
  AND e."roomNumber" = r."roomNumber";

DO $$
DECLARE
  n int;
  org text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "MinibarEvent" WHERE "organizationId" IS NULL) THEN
    RETURN;
  END IF;
  SELECT COUNT(DISTINCT "organizationId") INTO n FROM "HotelProfile";
  IF n = 1 THEN
    SELECT "organizationId" INTO org FROM "HotelProfile" LIMIT 1;
    UPDATE "MinibarEvent" SET "organizationId" = org WHERE "organizationId" IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM "MinibarEvent" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'MinibarEvent: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "MinibarEvent" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "MinibarEvent_organizationId_idx" ON "MinibarEvent"("organizationId");

ALTER TABLE "ChannelRoomMapping" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "ChannelRoomMapping" AS c
SET "organizationId" = p."organizationId"
FROM "Channel" AS p
WHERE c."channelId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ChannelRoomMapping" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ChannelRoomMapping: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "ChannelRoomMapping" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ChannelRoomMapping_organizationId_idx" ON "ChannelRoomMapping"("organizationId");

ALTER TABLE "ChannelRateMapping" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "ChannelRateMapping" AS c
SET "organizationId" = p."organizationId"
FROM "Channel" AS p
WHERE c."channelId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ChannelRateMapping" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ChannelRateMapping: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "ChannelRateMapping" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ChannelRateMapping_organizationId_idx" ON "ChannelRateMapping"("organizationId");

ALTER TABLE "EventOrderLine" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "EventOrderLine" AS c
SET "organizationId" = p."organizationId"
FROM "BanquetEvent" AS p
WHERE c."banquetEventId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "EventOrderLine" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'EventOrderLine: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "EventOrderLine" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "EventOrderLine_organizationId_idx" ON "EventOrderLine"("organizationId");

ALTER TABLE "EventResourceBooking" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "EventResourceBooking" AS c
SET "organizationId" = p."organizationId"
FROM "BanquetEvent" AS p
WHERE c."banquetEventId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "EventResourceBooking" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'EventResourceBooking: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "EventResourceBooking" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "EventResourceBooking_organizationId_idx" ON "EventResourceBooking"("organizationId");

ALTER TABLE "EventStaffAssignment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "EventStaffAssignment" AS c
SET "organizationId" = p."organizationId"
FROM "BanquetEvent" AS p
WHERE c."banquetEventId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "EventStaffAssignment" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'EventStaffAssignment: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "EventStaffAssignment" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "EventStaffAssignment_organizationId_idx" ON "EventStaffAssignment"("organizationId");

ALTER TABLE "PosReservation" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "PosReservation" AS c
SET "organizationId" = p."organizationId"
FROM "PosResource" AS p
WHERE c."resourceId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "PosReservation" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'PosReservation: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "PosReservation" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "PosReservation_organizationId_idx" ON "PosReservation"("organizationId");
ALTER TABLE "PosBridgeShift" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "PosBridgeShift" AS s
SET "organizationId" = h."organizationId"
FROM "HotelProfile" AS h
WHERE s."organizationId" IS NULL
  AND s."propertyCode" IS NOT NULL
  AND s."propertyCode" = h."propertyCode";

DO $$
DECLARE
  n int;
  org text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "PosBridgeShift" WHERE "organizationId" IS NULL) THEN
    RETURN;
  END IF;
  SELECT COUNT(DISTINCT "organizationId") INTO n FROM "HotelProfile";
  IF n = 1 THEN
    SELECT "organizationId" INTO org FROM "HotelProfile" LIMIT 1;
    UPDATE "PosBridgeShift" SET "organizationId" = org WHERE "organizationId" IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM "PosBridgeShift" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'PosBridgeShift: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "PosBridgeShift" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "PosBridgeShift_organizationId_idx" ON "PosBridgeShift"("organizationId");

ALTER TABLE "PosBridgeShift" DROP CONSTRAINT IF EXISTS "PosBridgeShift_outletCode_externalShiftId_key";
DROP INDEX IF EXISTS "PosBridgeShift_outletCode_externalShiftId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PosBridgeShift_organizationId_outletCode_externalShiftId_key"
  ON "PosBridgeShift"("organizationId", "outletCode", "externalShiftId");

ALTER TABLE "PosRoomChargeIdempotency" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "PosRoomChargeIdempotency" AS c
SET "organizationId" = p."organizationId"
FROM "Reservation" AS p
WHERE c."reservationId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "PosRoomChargeIdempotency" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'PosRoomChargeIdempotency: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "PosRoomChargeIdempotency" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "PosRoomChargeIdempotency_organizationId_idx" ON "PosRoomChargeIdempotency"("organizationId");

ALTER TABLE "PosRoomChargeIdempotency" DROP CONSTRAINT IF EXISTS "PosRoomChargeIdempotency_idempotencyKey_key";
DROP INDEX IF EXISTS "PosRoomChargeIdempotency_idempotencyKey_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PosRoomChargeIdempotency_organizationId_idempotencyKey_key"
  ON "PosRoomChargeIdempotency"("organizationId", "idempotencyKey");

ALTER TABLE "TransferOrder" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "TransferOrder" AS c
SET "organizationId" = p."organizationId"
FROM "Reservation" AS p
WHERE c."reservationId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "TransferOrder" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'TransferOrder: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "TransferOrder" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "TransferOrder_organizationId_idx" ON "TransferOrder"("organizationId");

ALTER TABLE "TourBooking" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "TourBooking" AS c
SET "organizationId" = p."organizationId"
FROM "TourDeparture" AS p
WHERE c."departureId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "TourBooking" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'TourBooking: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "TourBooking" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "TourBooking_organizationId_idx" ON "TourBooking"("organizationId");

ALTER TABLE "ConciergeOrder" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "ConciergeOrder" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ConciergeOrder" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ConciergeOrder: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "ConciergeOrder" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ConciergeOrder_organizationId_idx" ON "ConciergeOrder"("organizationId");
ALTER TABLE "DispatchRequest" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "DispatchRequest" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

UPDATE "DispatchRequest" AS c
SET "organizationId" = p."organizationId"
FROM "DispatchVehicle" AS p
WHERE c."vehicleId" = p.id
  AND c."organizationId" IS NULL;

DO $$
DECLARE
  n int;
  org text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "DispatchRequest" WHERE "organizationId" IS NULL) THEN
    RETURN;
  END IF;
  SELECT COUNT(DISTINCT "organizationId") INTO n FROM "HotelProfile";
  IF n = 1 THEN
    SELECT "organizationId" INTO org FROM "HotelProfile" LIMIT 1;
    UPDATE "DispatchRequest" SET "organizationId" = org WHERE "organizationId" IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM "DispatchRequest" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'DispatchRequest: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "DispatchRequest" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "DispatchRequest_organizationId_idx" ON "DispatchRequest"("organizationId");

ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "StockMovement" AS c
SET "organizationId" = p."organizationId"
FROM "Product" AS p
WHERE c."productId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "StockMovement" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'StockMovement: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "StockMovement" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "StockMovement_organizationId_idx" ON "StockMovement"("organizationId");

ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "Recipe" AS c
SET "organizationId" = p."organizationId"
FROM "Product" AS p
WHERE c."productId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Recipe" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'Recipe: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "Recipe" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "Recipe_organizationId_idx" ON "Recipe"("organizationId");

ALTER TABLE "RecipeLine" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "RecipeLine" AS c
SET "organizationId" = p."organizationId"
FROM "Recipe" AS p
WHERE c."recipeId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "RecipeLine" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'RecipeLine: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "RecipeLine" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "RecipeLine_organizationId_idx" ON "RecipeLine"("organizationId");
