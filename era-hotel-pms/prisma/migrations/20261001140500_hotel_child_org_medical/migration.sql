-- Hotel child/line organizationId. Backfill from the parent row.
-- If this database has no organization at all, drop the unscoped leftovers instead of aborting migrate-all.

CREATE OR REPLACE FUNCTION pg_temp.era_stamp_child_org(tbl text) RETURNS void AS $era$
DECLARE
  n int;
  org text;
  leftover int;
BEGIN
  EXECUTE format('SELECT COUNT(*) FROM %I WHERE "organizationId" IS NULL', tbl) INTO leftover;
  IF leftover = 0 THEN
    RETURN;
  END IF;

  SELECT COUNT(DISTINCT "organizationId") INTO n
  FROM "HotelProfile"
  WHERE "organizationId" IS NOT NULL;
  IF n = 1 THEN
    SELECT "organizationId" INTO org
    FROM "HotelProfile"
    WHERE "organizationId" IS NOT NULL
    LIMIT 1;
  ELSIF n = 0 THEN
    SELECT COUNT(DISTINCT "organizationId") INTO n
    FROM "Reservation"
    WHERE "organizationId" IS NOT NULL;
    IF n = 1 THEN
      SELECT "organizationId" INTO org
      FROM "Reservation"
      WHERE "organizationId" IS NOT NULL
      LIMIT 1;
    ELSIF n = 0 THEN
      SELECT COUNT(DISTINCT "organizationId") INTO n
      FROM "Guest"
      WHERE "organizationId" IS NOT NULL;
      IF n = 1 THEN
        SELECT "organizationId" INTO org
        FROM "Guest"
        WHERE "organizationId" IS NOT NULL
        LIMIT 1;
      END IF;
    END IF;
  END IF;

  IF org IS NOT NULL THEN
    EXECUTE format('UPDATE %I SET "organizationId" = $1 WHERE "organizationId" IS NULL', tbl) USING org;
  ELSIF n = 0 THEN
    EXECUTE format('DELETE FROM %I WHERE "organizationId" IS NULL', tbl);
  END IF;

  EXECUTE format('SELECT COUNT(*) FROM %I WHERE "organizationId" IS NULL', tbl) INTO leftover;
  IF leftover > 0 THEN
    RAISE EXCEPTION '%: organizationId backfill left null rows', tbl;
  END IF;
END;
$era$ LANGUAGE plpgsql;


ALTER TABLE "MedicalAlert" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "MedicalAlert" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "MedicalAlert" WHERE "organizationId" IS NULL) THEN
    PERFORM pg_temp.era_stamp_child_org('MedicalAlert');
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
    PERFORM pg_temp.era_stamp_child_org('MedicalOrder');
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
    PERFORM pg_temp.era_stamp_child_org('LabResult');
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
    PERFORM pg_temp.era_stamp_child_org('TourismSubmission');
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
    PERFORM pg_temp.era_stamp_child_org('MedicalProcedure');
  END IF;
END $$;

ALTER TABLE "MedicalProcedure" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "MedicalProcedure_organizationId_idx" ON "MedicalProcedure"("organizationId");
