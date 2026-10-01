-- Hotel child/line organizationId. Backfill from the parent row; fail if any row stays null.

ALTER TABLE "ReservationPaymentCard" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "ReservationPaymentCard" AS c
SET "organizationId" = p."organizationId"
FROM "Reservation" AS p
WHERE c."reservationId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ReservationPaymentCard" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ReservationPaymentCard: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "ReservationPaymentCard" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ReservationPaymentCard_organizationId_idx" ON "ReservationPaymentCard"("organizationId");


ALTER TABLE "ReservationPackageLine" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "ReservationPackageLine" AS c
SET "organizationId" = p."organizationId"
FROM "Reservation" AS p
WHERE c."reservationId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ReservationPackageLine" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ReservationPackageLine: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "ReservationPackageLine" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ReservationPackageLine_organizationId_idx" ON "ReservationPackageLine"("organizationId");


ALTER TABLE "ReservationTask" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "ReservationTask" AS c
SET "organizationId" = p."organizationId"
FROM "Reservation" AS p
WHERE c."reservationId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ReservationTask" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ReservationTask: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "ReservationTask" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ReservationTask_organizationId_idx" ON "ReservationTask"("organizationId");


ALTER TABLE "ReservationGuest" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "ReservationGuest" AS c
SET "organizationId" = p."organizationId"
FROM "Reservation" AS p
WHERE c."reservationId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ReservationGuest" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ReservationGuest: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "ReservationGuest" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ReservationGuest_organizationId_idx" ON "ReservationGuest"("organizationId");


ALTER TABLE "ReservationAttachment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "ReservationAttachment" AS c
SET "organizationId" = p."organizationId"
FROM "Reservation" AS p
WHERE c."reservationId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ReservationAttachment" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ReservationAttachment: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "ReservationAttachment" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ReservationAttachment_organizationId_idx" ON "ReservationAttachment"("organizationId");


ALTER TABLE "ReservationNote" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "ReservationNote" AS c
SET "organizationId" = p."organizationId"
FROM "Reservation" AS p
WHERE c."reservationId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ReservationNote" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ReservationNote: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "ReservationNote" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ReservationNote_organizationId_idx" ON "ReservationNote"("organizationId");


ALTER TABLE "ReservationDailyRate" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "ReservationDailyRate" AS c
SET "organizationId" = p."organizationId"
FROM "Reservation" AS p
WHERE c."reservationId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ReservationDailyRate" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ReservationDailyRate: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "ReservationDailyRate" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ReservationDailyRate_organizationId_idx" ON "ReservationDailyRate"("organizationId");


ALTER TABLE "ReservationStaySlice" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "ReservationStaySlice" AS c
SET "organizationId" = p."organizationId"
FROM "Reservation" AS p
WHERE c."reservationId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ReservationStaySlice" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ReservationStaySlice: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "ReservationStaySlice" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ReservationStaySlice_organizationId_idx" ON "ReservationStaySlice"("organizationId");


ALTER TABLE "RoomChangePlan" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "RoomChangePlan" AS c
SET "organizationId" = p."organizationId"
FROM "Reservation" AS p
WHERE c."reservationId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "RoomChangePlan" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'RoomChangePlan: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "RoomChangePlan" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "RoomChangePlan_organizationId_idx" ON "RoomChangePlan"("organizationId");


ALTER TABLE "AllotmentBlockLine" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "AllotmentBlockLine" AS c
SET "organizationId" = p."organizationId"
FROM "AllotmentBlock" AS p
WHERE c."allotmentBlockId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "AllotmentBlockLine" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'AllotmentBlockLine: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "AllotmentBlockLine" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "AllotmentBlockLine_organizationId_idx" ON "AllotmentBlockLine"("organizationId");
