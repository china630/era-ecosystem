-- CLI-51: program template versioning + instance entitlement snapshot
ALTER TABLE "ProgramTemplate" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ProgramTemplate" ADD COLUMN IF NOT EXISTS "is_current" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProgramTemplate" ADD COLUMN IF NOT EXISTS "retired_at" TIMESTAMP(3);
ALTER TABLE "ProgramTemplate" ADD COLUMN IF NOT EXISTS "supersedes_id" TEXT;

ALTER TABLE "ProgramInstance" ADD COLUMN IF NOT EXISTS "entitlement_snapshot" JSONB;

-- Replace unique (organizationId, code) with (organizationId, code, version)
DROP INDEX IF EXISTS "ProgramTemplate_organization_id_code_key";
ALTER TABLE "ProgramTemplate" DROP CONSTRAINT IF EXISTS "ProgramTemplate_organization_id_code_key";
ALTER TABLE "ProgramTemplate" DROP CONSTRAINT IF EXISTS "ProgramTemplate_organizationId_code_key";

CREATE UNIQUE INDEX IF NOT EXISTS "ProgramTemplate_organization_id_code_version_key"
  ON "ProgramTemplate"("organization_id", "code", "version");

CREATE INDEX IF NOT EXISTS "ProgramTemplate_organization_id_code_is_current_idx"
  ON "ProgramTemplate"("organization_id", "code", "is_current");
