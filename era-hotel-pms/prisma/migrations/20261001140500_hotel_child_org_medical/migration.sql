-- Hotel child/line organizationId. Backfill from the parent row; fail if any row stays null.

ALTER TABLE "MedicalAlert" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "MedicalAlert" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "MedicalAlert" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'MedicalAlert: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "MedicalAlert" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "MedicalAlert_organizationId_idx" ON "MedicalAlert"("organizationId");

ALTER TABLE "MedicalOrder" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "MedicalOrder" AS c
SET "organizationId" = p."organizationId"
FROM "Reservation" AS p
WHERE c."reservationId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "MedicalOrder" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'MedicalOrder: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "MedicalOrder" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "MedicalOrder_organizationId_idx" ON "MedicalOrder"("organizationId");

ALTER TABLE "LabResult" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "LabResult" AS c
SET "organizationId" = p."organizationId"
FROM "MedicalOrder" AS p
WHERE c."medicalOrderId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "LabResult" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'LabResult: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "LabResult" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "LabResult_organizationId_idx" ON "LabResult"("organizationId");

ALTER TABLE "TourismSubmission" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "TourismSubmission" AS c
SET "organizationId" = p."organizationId"
FROM "Reservation" AS p
WHERE c."reservationId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "TourismSubmission" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'TourismSubmission: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "TourismSubmission" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "TourismSubmission_organizationId_idx" ON "TourismSubmission"("organizationId");
ALTER TABLE "MedicalProcedure" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "MedicalProcedure" AS c
SET "organizationId" = p."organizationId"
FROM "Reservation" AS p
WHERE c."reservationId" = p.id
  AND c."organizationId" IS NULL;

DO $$
DECLARE
  n int;
  org text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "MedicalProcedure" WHERE "organizationId" IS NULL) THEN
    RETURN;
  END IF;
  SELECT COUNT(DISTINCT "organizationId") INTO n FROM "HotelProfile";
  IF n = 1 THEN
    SELECT "organizationId" INTO org FROM "HotelProfile" LIMIT 1;
    UPDATE "MedicalProcedure" SET "organizationId" = org WHERE "organizationId" IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM "MedicalProcedure" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'MedicalProcedure: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "MedicalProcedure" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "MedicalProcedure_organizationId_idx" ON "MedicalProcedure"("organizationId");
