-- SHARED-schema: additive organizationId (CP-TENANT-01)
CREATE TABLE IF NOT EXISTS "_era_organization_bind" (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  "organizationId" TEXT NOT NULL,
  "boundAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "boundBy" TEXT
);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "Tenant" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "Tenant_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_organization_id_code_key" ON "Tenant"("organization_id", "code");
CREATE INDEX IF NOT EXISTS "Tenant_organization_id_idx" ON "Tenant"("organization_id");
ALTER TABLE "Outlet" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "Outlet" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "Outlet_organization_id_idx" ON "Outlet"("organization_id");
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "Project" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "Project_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Project_organization_id_code_key" ON "Project"("organization_id", "code");
CREATE INDEX IF NOT EXISTS "Project_organization_id_idx" ON "Project"("organization_id");
ALTER TABLE "ProjectTask" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "ProjectTask" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "ProjectTask_organization_id_idx" ON "ProjectTask"("organization_id");
ALTER TABLE "EquipmentLog" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "EquipmentLog" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "EquipmentLog_organization_id_idx" ON "EquipmentLog"("organization_id");
ALTER TABLE "DrawingRevision" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "DrawingRevision" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "DrawingRevision_organization_id_idx" ON "DrawingRevision"("organization_id");
ALTER TABLE "TimesheetEntry" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "TimesheetEntry" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "TimesheetEntry_organization_id_idx" ON "TimesheetEntry"("organization_id");
ALTER TABLE "DailyLog" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "DailyLog" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "DailyLog_organization_id_idx" ON "DailyLog"("organization_id");
ALTER TABLE "PunchListItem" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "PunchListItem" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "PunchListItem_organization_id_idx" ON "PunchListItem"("organization_id");
ALTER TABLE "SubcontractorClaim" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "SubcontractorClaim" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "SubcontractorClaim_organization_id_idx" ON "SubcontractorClaim"("organization_id");
ALTER TABLE "BoqLine" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "BoqLine" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "BoqLine_organization_id_idx" ON "BoqLine"("organization_id");
ALTER TABLE "MaterialRequisition" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "MaterialRequisition" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "MaterialRequisition_organization_id_idx" ON "MaterialRequisition"("organization_id");
ALTER TABLE "ProgressAct" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "ProgressAct" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "ProgressAct_organization_id_idx" ON "ProgressAct"("organization_id");
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "Role" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "Role_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Role_organization_id_code_key" ON "Role"("organization_id", "code");
CREATE INDEX IF NOT EXISTS "Role_organization_id_idx" ON "Role"("organization_id");
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "User" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "User_login_key";
CREATE UNIQUE INDEX IF NOT EXISTS "User_organization_id_login_key" ON "User"("organization_id", "login");
CREATE INDEX IF NOT EXISTS "User_organization_id_idx" ON "User"("organization_id");
