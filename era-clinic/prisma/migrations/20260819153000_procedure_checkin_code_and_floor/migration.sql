-- W2 (CLI-44): Procedure check-in modes + procedure access codes

-- New enum for check-in mode (tenant-level)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProcedureCheckInMode') THEN
    CREATE TYPE "ProcedureCheckInMode" AS ENUM ('QR', 'CODE', 'MANUAL');
  END IF;
END $$;

-- Extend existing check-in channel enum with CODE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProcedureCheckInChannel') THEN
    BEGIN
      ALTER TYPE "ProcedureCheckInChannel" ADD VALUE 'CODE';
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;
  END IF;
END $$;

ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "procedure_check_in_mode" "ProcedureCheckInMode" NOT NULL DEFAULT 'QR';

-- Legacy compat: derive from check_in_requires_qr
UPDATE "Tenant"
SET "procedure_check_in_mode" = CASE
  WHEN "check_in_requires_qr" = true THEN 'QR'::"ProcedureCheckInMode"
  ELSE 'MANUAL'::"ProcedureCheckInMode"
END;

ALTER TABLE "ProcedureOrder"
  ADD COLUMN IF NOT EXISTS "access_code" TEXT;

-- Unique per clinic (tenant)
CREATE UNIQUE INDEX IF NOT EXISTS "ProcedureOrder_organizationId_accessCode_key"
  ON "ProcedureOrder"("organization_id", "access_code");

