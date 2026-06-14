CREATE TYPE "TaxResidencyStatus" AS ENUM ('RESIDENT', 'NON_RESIDENT');

ALTER TABLE "employees" ALTER COLUMN "fin_code" DROP NOT NULL;

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "global_person_id" UUID;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "tax_residency_status" "TaxResidencyStatus" NOT NULL DEFAULT 'RESIDENT';
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "nationality" TEXT DEFAULT 'AZ';
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "passport_number_cipher" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "passport_blind_index" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "issuing_country" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "work_permit_number" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "emas_eligible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "provisioned_satellite_key" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "provisioned_satellite_role" TEXT;

CREATE INDEX IF NOT EXISTS "employees_global_person_id_idx" ON "employees" ("global_person_id");
