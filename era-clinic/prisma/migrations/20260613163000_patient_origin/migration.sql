-- W3-0: ensure patientOrigin on Visit (idempotent for existing vNext deployments)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PatientOrigin') THEN
    CREATE TYPE "PatientOrigin" AS ENUM ('WALK_IN', 'IN_HOUSE');
  END IF;
END $$;

ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "patientOrigin" "PatientOrigin" NOT NULL DEFAULT 'WALK_IN';
