-- ServiceCatalogKind: procedure vs diagnostic/lab/visit
DO $$ BEGIN
  CREATE TYPE "ServiceCatalogKind" AS ENUM ('PROCEDURE', 'DIAGNOSTIC', 'LAB', 'VISIT', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ServiceCatalogCache" ADD COLUMN IF NOT EXISTS "kind" "ServiceCatalogKind" NOT NULL DEFAULT 'OTHER';

UPDATE "ServiceCatalogCache" SET "kind" = 'PROCEDURE'
WHERE "code" LIKE 'SVC-%' OR ("department" IS NOT NULL AND TRIM("department") <> '');

UPDATE "ServiceCatalogCache" SET "kind" = 'LAB'
WHERE "kind" = 'OTHER' AND ("code" LIKE 'LAB-%' OR "code" LIKE 'LAB_%');

UPDATE "ServiceCatalogCache" SET "kind" = 'DIAGNOSTIC'
WHERE "kind" = 'OTHER' AND (
  "code" LIKE 'CT-%' OR "code" LIKE 'MR-%' OR "code" LIKE 'XR-%' OR "code" LIKE 'US-%'
  OR "code" LIKE 'USG%' OR "code" LIKE 'ECG%' OR "code" LIKE 'ECHO%' OR "code" LIKE 'DXA%'
  OR "code" LIKE 'ABPM%' OR "code" LIKE 'AUDIO%' OR "code" LIKE 'BRONCHO%' OR "code" LIKE 'COLONO%'
  OR "code" LIKE 'COLPO%' OR "code" LIKE 'CORO%' OR "code" LIKE 'CYSTO%' OR "code" LIKE 'DERM%'
  OR "code" LIKE 'ENDO%' OR "code" LIKE 'EEG%' OR "code" LIKE 'EMG%' OR "code" LIKE 'HOLTER%'
  OR "code" LIKE 'MAMMO%' OR "code" LIKE 'PET%' OR "code" LIKE 'SPIRO%' OR "code" LIKE 'UROFLOW%'
);

UPDATE "ServiceCatalogCache" SET "kind" = 'VISIT'
WHERE "kind" = 'OTHER' AND ("code" LIKE 'VISIT-%' OR "code" IN ('CONSULT'));
