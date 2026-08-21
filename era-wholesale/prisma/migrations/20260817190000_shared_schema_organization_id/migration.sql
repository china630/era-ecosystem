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
ALTER TABLE "B2BOrder" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "B2BOrder" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "B2BOrder_orderNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "B2BOrder_organization_id_orderNumber_key" ON "B2BOrder"("organization_id", "orderNumber");
CREATE INDEX IF NOT EXISTS "B2BOrder_organization_id_idx" ON "B2BOrder"("organization_id");
ALTER TABLE "ImportPurchaseOrder" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "ImportPurchaseOrder" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "ImportPurchaseOrder_externalRef_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ImportPurchaseOrder_organization_id_externalRef_key" ON "ImportPurchaseOrder"("organization_id", "externalRef");
CREATE INDEX IF NOT EXISTS "ImportPurchaseOrder_organization_id_idx" ON "ImportPurchaseOrder"("organization_id");
ALTER TABLE "ImportPurchaseOrderLine" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "ImportPurchaseOrderLine" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "ImportPurchaseOrderLine_organization_id_idx" ON "ImportPurchaseOrderLine"("organization_id");
ALTER TABLE "PickList" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "PickList" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "PickList_organization_id_idx" ON "PickList"("organization_id");
ALTER TABLE "PickListLine" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "PickListLine" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "PickListLine_organization_id_idx" ON "PickListLine"("organization_id");
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
