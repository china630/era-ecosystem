DO $migration$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PersonDocumentKind') THEN
    CREATE TYPE "PersonDocumentKind" AS ENUM ('ID_CARD', 'PASSPORT');
  END IF;
END $migration$;

CREATE TABLE IF NOT EXISTS "person_identity_documents" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "person_id" UUID NOT NULL,
  "kind" "PersonDocumentKind" NOT NULL,
  "series_cipher" TEXT,
  "number_cipher" TEXT,
  "issued_by_cipher" TEXT,
  "issued_on" DATE,
  "expires_on" DATE,
  "issuing_country" VARCHAR(2) NOT NULL DEFAULT 'AZ',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "person_identity_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "person_identity_documents_person_id_kind_key"
  ON "person_identity_documents"("person_id", "kind");
CREATE INDEX IF NOT EXISTS "person_identity_documents_person_id_idx"
  ON "person_identity_documents"("person_id");

DO $$ BEGIN
  ALTER TABLE "person_identity_documents"
    ADD CONSTRAINT "person_identity_documents_person_id_fkey"
    FOREIGN KEY ("person_id") REFERENCES "global_natural_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
