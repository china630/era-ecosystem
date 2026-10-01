-- Hotel child/line organizationId. Backfill from the parent row; fail if any row stays null.

ALTER TABLE "MigrationRegistration" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "MigrationRegistration" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "MigrationRegistration" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'MigrationRegistration: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "MigrationRegistration" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "MigrationRegistration_organizationId_idx" ON "MigrationRegistration"("organizationId");


ALTER TABLE "GuestTag" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "GuestTag" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GuestTag" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'GuestTag: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "GuestTag" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GuestTag_organizationId_idx" ON "GuestTag"("organizationId");


ALTER TABLE "GuestArchiveFile" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "GuestArchiveFile" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GuestArchiveFile" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'GuestArchiveFile: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "GuestArchiveFile" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GuestArchiveFile_organizationId_idx" ON "GuestArchiveFile"("organizationId");


ALTER TABLE "GuestPreference" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "GuestPreference" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GuestPreference" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'GuestPreference: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "GuestPreference" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GuestPreference_organizationId_idx" ON "GuestPreference"("organizationId");


ALTER TABLE "GuestAllergen" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "GuestAllergen" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GuestAllergen" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'GuestAllergen: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "GuestAllergen" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GuestAllergen_organizationId_idx" ON "GuestAllergen"("organizationId");


ALTER TABLE "GuestSpecialDate" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "GuestSpecialDate" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GuestSpecialDate" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'GuestSpecialDate: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "GuestSpecialDate" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GuestSpecialDate_organizationId_idx" ON "GuestSpecialDate"("organizationId");


ALTER TABLE "GuestFavoriteRoom" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "GuestFavoriteRoom" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GuestFavoriteRoom" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'GuestFavoriteRoom: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "GuestFavoriteRoom" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GuestFavoriteRoom_organizationId_idx" ON "GuestFavoriteRoom"("organizationId");


ALTER TABLE "GuestComment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "GuestComment" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GuestComment" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'GuestComment: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "GuestComment" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GuestComment_organizationId_idx" ON "GuestComment"("organizationId");


ALTER TABLE "GuestSurvey" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "GuestSurvey" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GuestSurvey" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'GuestSurvey: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "GuestSurvey" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GuestSurvey_organizationId_idx" ON "GuestSurvey"("organizationId");


ALTER TABLE "GuestIncident" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "GuestIncident" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GuestIncident" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'GuestIncident: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "GuestIncident" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GuestIncident_organizationId_idx" ON "GuestIncident"("organizationId");


ALTER TABLE "GuestCommunication" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "GuestCommunication" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GuestCommunication" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'GuestCommunication: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "GuestCommunication" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GuestCommunication_organizationId_idx" ON "GuestCommunication"("organizationId");


ALTER TABLE "GuestContactLog" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "GuestContactLog" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GuestContactLog" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'GuestContactLog: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "GuestContactLog" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GuestContactLog_organizationId_idx" ON "GuestContactLog"("organizationId");


ALTER TABLE "GuestFamily" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "GuestFamily" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GuestFamily" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'GuestFamily: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "GuestFamily" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GuestFamily_organizationId_idx" ON "GuestFamily"("organizationId");


ALTER TABLE "GuestLoyaltyCard" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "GuestLoyaltyCard" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GuestLoyaltyCard" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'GuestLoyaltyCard: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "GuestLoyaltyCard" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GuestLoyaltyCard_organizationId_idx" ON "GuestLoyaltyCard"("organizationId");


ALTER TABLE "GuestLoyaltyPointEntry" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "GuestLoyaltyPointEntry" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GuestLoyaltyPointEntry" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'GuestLoyaltyPointEntry: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "GuestLoyaltyPointEntry" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GuestLoyaltyPointEntry_organizationId_idx" ON "GuestLoyaltyPointEntry"("organizationId");


ALTER TABLE "GuestTimeShareAgreement" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "GuestTimeShareAgreement" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GuestTimeShareAgreement" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'GuestTimeShareAgreement: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "GuestTimeShareAgreement" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GuestTimeShareAgreement_organizationId_idx" ON "GuestTimeShareAgreement"("organizationId");


ALTER TABLE "GuestNote" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "GuestNote" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GuestNote" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'GuestNote: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "GuestNote" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GuestNote_organizationId_idx" ON "GuestNote"("organizationId");


ALTER TABLE "GuestTask" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "GuestTask" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GuestTask" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'GuestTask: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "GuestTask" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GuestTask_organizationId_idx" ON "GuestTask"("organizationId");


ALTER TABLE "GuestDocument" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "GuestDocument" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GuestDocument" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'GuestDocument: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "GuestDocument" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GuestDocument_organizationId_idx" ON "GuestDocument"("organizationId");


ALTER TABLE "GuestContact" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "GuestContact" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GuestContact" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'GuestContact: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "GuestContact" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GuestContact_organizationId_idx" ON "GuestContact"("organizationId");


ALTER TABLE "GuestAddress" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "GuestAddress" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GuestAddress" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'GuestAddress: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "GuestAddress" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GuestAddress_organizationId_idx" ON "GuestAddress"("organizationId");


ALTER TABLE "GuestCrmExtension" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "GuestCrmExtension" AS c
SET "organizationId" = p."organizationId"
FROM "Guest" AS p
WHERE c."guestId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "GuestCrmExtension" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'GuestCrmExtension: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "GuestCrmExtension" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GuestCrmExtension_organizationId_idx" ON "GuestCrmExtension"("organizationId");
