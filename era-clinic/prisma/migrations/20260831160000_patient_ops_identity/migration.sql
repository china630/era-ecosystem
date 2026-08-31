-- Wave 1: clinic-native patient codes + name parts; Wave 2: lab cancel
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "next_patient_seq" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "PatientRef" ADD COLUMN IF NOT EXISTS "given_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PatientRef" ADD COLUMN IF NOT EXISTS "surname" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PatientRef" ADD COLUMN IF NOT EXISTS "father_name" TEXT;

-- Drop AZ default on nationality (nullable, no default)
ALTER TABLE "PatientRef" ALTER COLUMN "nationality" DROP DEFAULT;

-- Best-effort name backfill: keep fullName as givenName when parts empty
UPDATE "PatientRef"
SET "given_name" = "fullName"
WHERE ("given_name" IS NULL OR "given_name" = '') AND "fullName" IS NOT NULL AND "fullName" <> '';

-- Lab order soft-cancel (Wave 2)
ALTER TYPE "LabOrderStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "cancelled_by_user_id" TEXT;
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "cancel_reason" TEXT;
