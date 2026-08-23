-- CLI-48 gender session windows + CLI-49 replan preview/snapshot

CREATE TYPE "GenderSessionMode" AS ENUM ('OFF', 'SPLIT_BY_LUNCH', 'CUSTOM_WINDOWS');
CREATE TYPE "GenderSessionPolicy" AS ENUM ('OFF', 'INHERIT', 'SPLIT_BY_LUNCH', 'CUSTOM');
CREATE TYPE "GenderSessionUnknownPolicy" AS ENUM ('BLOCK', 'ALLOW_BOTH');
CREATE TYPE "ProcedureReplanMode" AS ENUM ('FILL_HOLES', 'PACK_RESOURCE', 'APPLY_GENDER_WINDOWS', 'NUCLEAR_DAY');

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "gender_session_mode" "GenderSessionMode" NOT NULL DEFAULT 'OFF';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "gender_session_female_first" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "gender_session_unknown" "GenderSessionUnknownPolicy" NOT NULL DEFAULT 'BLOCK';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "gender_session_female_start_hour" INTEGER;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "gender_session_female_end_hour" INTEGER;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "gender_session_male_start_hour" INTEGER;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "gender_session_male_end_hour" INTEGER;

ALTER TABLE "ProcedureType" ADD COLUMN IF NOT EXISTS "gender_session_policy" "GenderSessionPolicy" NOT NULL DEFAULT 'OFF';
ALTER TABLE "ProcedureType" ADD COLUMN IF NOT EXISTS "gender_session_female_start_hour" INTEGER;
ALTER TABLE "ProcedureType" ADD COLUMN IF NOT EXISTS "gender_session_female_end_hour" INTEGER;
ALTER TABLE "ProcedureType" ADD COLUMN IF NOT EXISTS "gender_session_male_start_hour" INTEGER;
ALTER TABLE "ProcedureType" ADD COLUMN IF NOT EXISTS "gender_session_male_end_hour" INTEGER;

UPDATE "ProcedureType"
SET "gender_session_policy" = 'SPLIT_BY_LUNCH'
WHERE "code" IN (
  'SVC-4-KAMERALI-NAFTALAN-VANNASI',
  'SVC-4-KAMERALI-HIDROQALVANIZASIYA'
);

CREATE TABLE IF NOT EXISTS "ProcedureReplanPreview" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "mode" "ProcedureReplanMode" NOT NULL,
  "baku_date" TEXT NOT NULL,
  "resource_id" TEXT,
  "procedure_type_id" TEXT,
  "respect_pins" BOOLEAN NOT NULL DEFAULT true,
  "scope_hash" TEXT NOT NULL,
  "payload_json" TEXT NOT NULL,
  "created_by_user_id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "applied_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcedureReplanPreview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProcedureReplanSnapshot" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "preview_id" TEXT NOT NULL,
  "before_json" TEXT NOT NULL,
  "created_by_user_id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "undone_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcedureReplanSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProcedureReplanPreview_expires_at_idx" ON "ProcedureReplanPreview"("expires_at");
CREATE INDEX IF NOT EXISTS "ProcedureReplanPreview_organization_id_idx" ON "ProcedureReplanPreview"("organization_id");
CREATE INDEX IF NOT EXISTS "ProcedureReplanSnapshot_expires_at_idx" ON "ProcedureReplanSnapshot"("expires_at");
CREATE INDEX IF NOT EXISTS "ProcedureReplanSnapshot_organization_id_idx" ON "ProcedureReplanSnapshot"("organization_id");

ALTER TABLE "ProcedureReplanPreview"
  ADD CONSTRAINT "ProcedureReplanPreview_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcedureReplanSnapshot"
  ADD CONSTRAINT "ProcedureReplanSnapshot_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcedureReplanSnapshot"
  ADD CONSTRAINT "ProcedureReplanSnapshot_preview_id_fkey"
  FOREIGN KEY ("preview_id") REFERENCES "ProcedureReplanPreview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
