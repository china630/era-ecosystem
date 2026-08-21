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
ALTER TABLE "CustomerVehicle" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "CustomerVehicle" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "CustomerVehicle_plate_key";
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerVehicle_organization_id_plate_key" ON "CustomerVehicle"("organization_id", "plate");
CREATE INDEX IF NOT EXISTS "CustomerVehicle_organization_id_idx" ON "CustomerVehicle"("organization_id");
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "WorkOrder" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "WorkOrder_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "WorkOrder_organization_id_code_key" ON "WorkOrder"("organization_id", "code");
CREATE INDEX IF NOT EXISTS "WorkOrder_organization_id_idx" ON "WorkOrder"("organization_id");
ALTER TABLE "WorkOrderLaborLine" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "WorkOrderLaborLine" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "WorkOrderLaborLine_organization_id_idx" ON "WorkOrderLaborLine"("organization_id");
ALTER TABLE "WorkOrderPartLine" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "WorkOrderPartLine" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "WorkOrderPartLine_organization_id_idx" ON "WorkOrderPartLine"("organization_id");
ALTER TABLE "Bay" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "Bay" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "Bay_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Bay_organization_id_code_key" ON "Bay"("organization_id", "code");
CREATE INDEX IF NOT EXISTS "Bay_organization_id_idx" ON "Bay"("organization_id");
ALTER TABLE "Lift" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "Lift" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "Lift_organization_id_idx" ON "Lift"("organization_id");
ALTER TABLE "PartsCatalogEntry" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "PartsCatalogEntry" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "PartsCatalogEntry_organization_id_idx" ON "PartsCatalogEntry"("organization_id");
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "Appointment" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "Appointment_organization_id_idx" ON "Appointment"("organization_id");
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "Tool" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "Tool_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Tool_organization_id_code_key" ON "Tool"("organization_id", "code");
CREATE INDEX IF NOT EXISTS "Tool_organization_id_idx" ON "Tool"("organization_id");
ALTER TABLE "ToolCheckout" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "ToolCheckout" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "ToolCheckout_organization_id_idx" ON "ToolCheckout"("organization_id");
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
