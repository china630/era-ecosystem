-- SHARED-schema: additive organizationId (CP-TENANT-01 / B7). No SHARED bank pool this edition.
CREATE TABLE IF NOT EXISTS "_era_organization_bind" (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  "organizationId" TEXT NOT NULL,
  "boundAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "boundBy" TEXT
);

ALTER TABLE "OpsRole" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "OpsRole" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "OpsRole_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "OpsRole_organization_id_code_key" ON "OpsRole"("organization_id", "code");
CREATE INDEX IF NOT EXISTS "OpsRole_organization_id_idx" ON "OpsRole"("organization_id");

ALTER TABLE "OpsUser" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "OpsUser" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "OpsUser_username_key";
CREATE UNIQUE INDEX IF NOT EXISTS "OpsUser_organization_id_username_key" ON "OpsUser"("organization_id", "username");
CREATE INDEX IF NOT EXISTS "OpsUser_organization_id_idx" ON "OpsUser"("organization_id");

ALTER TABLE "OpsSession" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "OpsSession" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "OpsSession_organization_id_idx" ON "OpsSession"("organization_id");

ALTER TABLE "OpsActionLog" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "OpsActionLog" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "OpsActionLog_organization_id_idx" ON "OpsActionLog"("organization_id");
