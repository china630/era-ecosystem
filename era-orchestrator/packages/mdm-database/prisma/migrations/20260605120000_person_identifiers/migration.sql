-- PersonIdentifier multi-key identity + person segment / merge support

CREATE TYPE "PersonIdentifierType" AS ENUM ('AZ_FIN', 'PASSPORT', 'RESIDENCE_PERMIT', 'NATIONAL_ID', 'ERA_SURROGATE');
CREATE TYPE "IdentifierTrust" AS ENUM ('SELF_DECLARED', 'DOCUMENT_SCANNED', 'GOVERNMENT_VERIFIED');
CREATE TYPE "PersonSegment" AS ENUM ('CITIZEN', 'FOREIGNER', 'UNVERIFIED');

ALTER TABLE "global_natural_persons" ADD COLUMN IF NOT EXISTS "nationality" TEXT DEFAULT 'AZ';
ALTER TABLE "global_natural_persons" ADD COLUMN IF NOT EXISTS "person_segment" "PersonSegment" NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE "global_natural_persons" ADD COLUMN IF NOT EXISTS "merged_into_person_id" UUID;

ALTER TABLE "global_natural_persons" ADD CONSTRAINT "global_natural_persons_merged_into_person_id_fkey"
  FOREIGN KEY ("merged_into_person_id") REFERENCES "global_natural_persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "global_natural_persons_merged_into_person_id_idx"
  ON "global_natural_persons"("merged_into_person_id");

CREATE TABLE IF NOT EXISTS "person_identifiers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "person_id" UUID NOT NULL,
    "type" "PersonIdentifierType" NOT NULL,
    "issuing_country" TEXT NOT NULL DEFAULT 'AZ',
    "value_cipher" TEXT NOT NULL,
    "blind_index" TEXT NOT NULL,
    "trust" "IdentifierTrust" NOT NULL DEFAULT 'SELF_DECLARED',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_identifiers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "person_identifiers_type_issuing_country_blind_index_key"
  ON "person_identifiers"("type", "issuing_country", "blind_index");

CREATE INDEX IF NOT EXISTS "person_identifiers_person_id_idx" ON "person_identifiers"("person_id");

ALTER TABLE "person_identifiers" ADD CONSTRAINT "person_identifiers_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "global_natural_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill AZ_FIN identifiers from legacy fin_blind_index rows
INSERT INTO "person_identifiers" ("person_id", "type", "issuing_country", "value_cipher", "blind_index", "trust", "is_primary")
SELECT
  p."id",
  'AZ_FIN'::"PersonIdentifierType",
  'AZ',
  COALESCE(p."fin_cipher", ''),
  p."fin_blind_index",
  'SELF_DECLARED'::"IdentifierTrust",
  true
FROM "global_natural_persons" p
WHERE p."fin_blind_index" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "person_identifiers" pi
    WHERE pi."type" = 'AZ_FIN' AND pi."issuing_country" = 'AZ' AND pi."blind_index" = p."fin_blind_index"
  );

UPDATE "global_natural_persons"
SET "person_segment" = 'CITIZEN'::"PersonSegment"
WHERE "fin_blind_index" IS NOT NULL AND "person_segment" = 'UNVERIFIED'::"PersonSegment";
