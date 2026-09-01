-- CreateEnum
CREATE TYPE "WorkforceProvisionState" AS ENUM ('PENDING', 'APPLIED', 'FAILED');

-- AlterTable
ALTER TABLE "workforce_role_bindings"
  ADD COLUMN IF NOT EXISTS "provision_state" "WorkforceProvisionState" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "last_provision_error" TEXT,
  ADD COLUMN IF NOT EXISTS "last_provision_at" TIMESTAMP(3);

-- Backfill: bindings that already have a satellite user id are APPLIED
UPDATE "workforce_role_bindings"
SET "provision_state" = 'APPLIED',
    "last_provision_at" = COALESCE("last_provision_at", "updated_at")
WHERE "satellite_user_id" IS NOT NULL
  AND "provision_state" = 'PENDING';

CREATE INDEX IF NOT EXISTS "workforce_role_bindings_provision_state_status_idx"
  ON "workforce_role_bindings" ("provision_state", "status");
