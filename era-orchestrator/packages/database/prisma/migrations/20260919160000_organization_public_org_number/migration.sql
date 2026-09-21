-- ERA ID: public organization number (6 digits). UUID remains canonical tenant key.
-- ADR: docs/adr/org-public-number-and-login-host.md

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "public_org_number" INTEGER;

-- Backfill existing rows with random unique numbers in 100000–999999 (including soft-deleted).
DO $$
DECLARE
  r RECORD;
  candidate INT;
  attempts INT;
BEGIN
  FOR r IN SELECT id FROM organizations WHERE public_org_number IS NULL LOOP
    attempts := 0;
    LOOP
      candidate := 100000 + floor(random() * 900000)::INT;
      BEGIN
        UPDATE organizations SET public_org_number = candidate WHERE id = r.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        attempts := attempts + 1;
        IF attempts > 64 THEN
          RAISE EXCEPTION 'Could not allocate public_org_number for %', r.id;
        END IF;
      END;
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE "organizations" ALTER COLUMN "public_org_number" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "organizations_public_org_number_key"
  ON "organizations"("public_org_number");
