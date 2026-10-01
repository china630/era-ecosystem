-- Hotel child/line organizationId. Backfill from the parent row; fail if any row stays null.

ALTER TABLE "RoomTypeRate" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "RoomTypeRate" AS c
SET "organizationId" = p."organizationId"
FROM "RatePlan" AS p
WHERE c."ratePlanId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "RoomTypeRate" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'RoomTypeRate: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "RoomTypeRate" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "RoomTypeRate_organizationId_idx" ON "RoomTypeRate"("organizationId");

ALTER TABLE "RatePlanAddOn" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "RatePlanAddOn" AS c
SET "organizationId" = p."organizationId"
FROM "RatePlan" AS p
WHERE c."ratePlanId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "RatePlanAddOn" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'RatePlanAddOn: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "RatePlanAddOn" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "RatePlanAddOn_organizationId_idx" ON "RatePlanAddOn"("organizationId");

ALTER TABLE "RatePlanPackageLine" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "RatePlanPackageLine" AS c
SET "organizationId" = p."organizationId"
FROM "RatePlan" AS p
WHERE c."ratePlanId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "RatePlanPackageLine" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'RatePlanPackageLine: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "RatePlanPackageLine" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "RatePlanPackageLine_organizationId_idx" ON "RatePlanPackageLine"("organizationId");

ALTER TABLE "RatePlanProcedureInclusion" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "RatePlanProcedureInclusion" AS c
SET "organizationId" = p."organizationId"
FROM "RatePlan" AS p
WHERE c."ratePlanId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "RatePlanProcedureInclusion" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'RatePlanProcedureInclusion: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "RatePlanProcedureInclusion" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "RatePlanProcedureInclusion_organizationId_idx" ON "RatePlanProcedureInclusion"("organizationId");

ALTER TABLE "RatePlanSellVersion" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "RatePlanSellVersion" AS c
SET "organizationId" = p."organizationId"
FROM "RatePlan" AS p
WHERE c."ratePlanId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "RatePlanSellVersion" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'RatePlanSellVersion: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "RatePlanSellVersion" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "RatePlanSellVersion_organizationId_idx" ON "RatePlanSellVersion"("organizationId");

ALTER TABLE "PricingComponentVersion" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "PricingComponentVersion" AS c
SET "organizationId" = p."organizationId"
FROM "PricingComponent" AS p
WHERE c."componentId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "PricingComponentVersion" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'PricingComponentVersion: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "PricingComponentVersion" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "PricingComponentVersion_organizationId_idx" ON "PricingComponentVersion"("organizationId");

ALTER TABLE "HotelRevenueGlMapping" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "HotelRevenueGlMapping" AS c
SET "organizationId" = p."organizationId"
FROM "RevenueCode" AS p
WHERE c."revenueCodeId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "HotelRevenueGlMapping" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'HotelRevenueGlMapping: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "HotelRevenueGlMapping" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "HotelRevenueGlMapping_organizationId_idx" ON "HotelRevenueGlMapping"("organizationId");

ALTER TABLE "ContractPricingRule" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "ContractPricingRule" AS c
SET "organizationId" = p."organizationId"
FROM "RatePlan" AS p
WHERE c."ratePlanId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ContractPricingRule" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ContractPricingRule: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "ContractPricingRule" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ContractPricingRule_organizationId_idx" ON "ContractPricingRule"("organizationId");

ALTER TABLE "ContractAllotment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "ContractAllotment" AS c
SET "organizationId" = p."organizationId"
FROM "SalesContract" AS p
WHERE c."salesContractId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ContractAllotment" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ContractAllotment: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "ContractAllotment" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ContractAllotment_organizationId_idx" ON "ContractAllotment"("organizationId");

ALTER TABLE "ProcedureAppointment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "ProcedureAppointment" AS c
SET "organizationId" = p."organizationId"
FROM "Reservation" AS p
WHERE c."reservationId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ProcedureAppointment" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ProcedureAppointment: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "ProcedureAppointment" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ProcedureAppointment_organizationId_idx" ON "ProcedureAppointment"("organizationId");
ALTER TABLE "ChildPricingMatrix" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

DO $$
DECLARE
  n int;
  first_org text;
  r record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "ChildPricingMatrix" WHERE "organizationId" IS NULL) THEN
    RETURN;
  END IF;

  SELECT "organizationId" INTO first_org
  FROM "HotelProfile"
  WHERE "organizationId" IS NOT NULL
  ORDER BY "organizationId"
  LIMIT 1;

  IF first_org IS NULL THEN
    SELECT "organizationId" INTO first_org
    FROM "Reservation"
    WHERE "organizationId" IS NOT NULL
    ORDER BY "organizationId"
    LIMIT 1;
  END IF;

  IF first_org IS NULL THEN
    SELECT "organizationId" INTO first_org
    FROM "Guest"
    WHERE "organizationId" IS NOT NULL
    ORDER BY "organizationId"
    LIMIT 1;
  END IF;

  -- No tenant on this database: unscoped matrix rows cannot be attributed.
  IF first_org IS NULL THEN
    DELETE FROM "ChildPricingMatrix" WHERE "organizationId" IS NULL;
    RETURN;
  END IF;

  UPDATE "ChildPricingMatrix" SET "organizationId" = first_org WHERE "organizationId" IS NULL;

  SELECT COUNT(DISTINCT "organizationId") INTO n
  FROM "HotelProfile"
  WHERE "organizationId" IS NOT NULL;

  IF n > 1 THEN
    FOR r IN
      SELECT DISTINCT "organizationId" AS organization_id
      FROM "HotelProfile"
      WHERE "organizationId" <> first_org
    LOOP
      INSERT INTO "ChildPricingMatrix" (
        "id", "organizationId", "ageFrom", "ageTo", "discountPercent",
        "amountOverride", "freeCount", "active", "createdAt"
      )
      SELECT
        gen_random_uuid()::text, r.organization_id, m."ageFrom", m."ageTo", m."discountPercent",
        m."amountOverride", m."freeCount", m."active", m."createdAt"
      FROM "ChildPricingMatrix" m
      WHERE m."organizationId" = first_org;
    END LOOP;
  END IF;
END $$;

ALTER TABLE "ChildPricingMatrix" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ChildPricingMatrix_organizationId_idx" ON "ChildPricingMatrix"("organizationId");
