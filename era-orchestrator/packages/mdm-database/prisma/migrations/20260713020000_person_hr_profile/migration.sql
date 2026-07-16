-- PersonHrProfile + PersonAddress (HR PII vault; Finance read-through only)

DO $migration$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BloodGroup') THEN
    CREATE TYPE "BloodGroup" AS ENUM (
      'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN'
    );
  END IF;
END $migration$;

DO $migration$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MaritalStatus') THEN
    CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'OTHER');
  END IF;
END $migration$;

DO $migration$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PersonAddressKind') THEN
    CREATE TYPE "PersonAddressKind" AS ENUM ('REGISTRATION', 'ACTUAL');
  END IF;
END $migration$;

DO $migration$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatisticalCategory') THEN
    CREATE TYPE "StatisticalCategory" AS ENUM ('REFUGEE', 'IDP', 'MARTYR_FAMILY', 'VETERAN');
  END IF;
END $migration$;

CREATE TABLE IF NOT EXISTS "person_hr_profiles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "person_id" UUID NOT NULL,
    "blood_group" "BloodGroup" NOT NULL DEFAULT 'UNKNOWN',
    "marital_status" "MaritalStatus",
    "education_cipher" TEXT,
    "specialty_cipher" TEXT,
    "statistical_categories" "StatisticalCategory"[] NOT NULL DEFAULT ARRAY[]::"StatisticalCategory"[],
    "photo_storage_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "person_hr_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "person_hr_profiles_person_id_key"
  ON "person_hr_profiles"("person_id");

DO $migration$ BEGIN
  ALTER TABLE "person_hr_profiles"
    ADD CONSTRAINT "person_hr_profiles_person_id_fkey"
    FOREIGN KEY ("person_id") REFERENCES "global_natural_persons"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $migration$;

CREATE TABLE IF NOT EXISTS "person_addresses" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "person_id" UUID NOT NULL,
    "kind" "PersonAddressKind" NOT NULL,
    "line_cipher" TEXT NOT NULL,
    "city_cipher" TEXT,
    "region_cipher" TEXT,
    "postal_cipher" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "person_addresses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "person_addresses_person_id_kind_key"
  ON "person_addresses"("person_id", "kind");

CREATE INDEX IF NOT EXISTS "person_addresses_person_id_idx"
  ON "person_addresses"("person_id");

DO $migration$ BEGIN
  ALTER TABLE "person_addresses"
    ADD CONSTRAINT "person_addresses_person_id_fkey"
    FOREIGN KEY ("person_id") REFERENCES "global_natural_persons"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $migration$;
