DO $migration$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'KinshipKind') THEN
    CREATE TYPE "KinshipKind" AS ENUM ('SPOUSE', 'PARENT', 'CHILD', 'SIBLING', 'OTHER');
  END IF;
END $migration$;

CREATE TABLE IF NOT EXISTS "person_kin_contacts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "person_id" UUID NOT NULL,
    "kinship" "KinshipKind" NOT NULL,
    "name_cipher" TEXT NOT NULL,
    "phone_cipher" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "person_kin_contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "person_kin_contacts_person_id_idx" ON "person_kin_contacts"("person_id");

DO $$ BEGIN
  ALTER TABLE "person_kin_contacts" ADD CONSTRAINT "person_kin_contacts_person_id_fkey"
    FOREIGN KEY ("person_id") REFERENCES "global_natural_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
