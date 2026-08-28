-- Person core identity: legal sex + birth date (SoR for all satellites). No OTHER.

DO $migration$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PersonSex') THEN
    CREATE TYPE "PersonSex" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');
  END IF;
END $migration$;

ALTER TABLE "global_natural_persons"
  ADD COLUMN IF NOT EXISTS "sex" "PersonSex" NOT NULL DEFAULT 'UNKNOWN';

ALTER TABLE "global_natural_persons"
  ADD COLUMN IF NOT EXISTS "birth_date" DATE;
