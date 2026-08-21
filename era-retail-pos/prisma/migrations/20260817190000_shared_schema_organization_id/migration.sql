-- SHARED-schema: additive organizationId on retail tenant roots
CREATE TABLE IF NOT EXISTS "_era_organization_bind" (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  "organizationId" TEXT NOT NULL,
  "boundAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "boundBy" TEXT
);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "Tenant" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "Tenant_code_key";
DROP INDEX IF EXISTS "Tenant_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_organization_id_code_key" ON "Tenant"("organization_id", "code");
CREATE INDEX IF NOT EXISTS "Tenant_organization_id_idx" ON "Tenant"("organization_id");
ALTER TABLE "Outlet" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "Outlet" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "Outlet_organization_id_idx" ON "Outlet"("organization_id");
ALTER TABLE "Register" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "Register" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "Register_organization_id_idx" ON "Register"("organization_id");
ALTER TABLE "Shift" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "Shift" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "Shift_organization_id_idx" ON "Shift"("organization_id");
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "Receipt" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "Receipt_organization_id_idx" ON "Receipt"("organization_id");
ALTER TABLE "ReceiptLine" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "ReceiptLine" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "ReceiptLine_organization_id_idx" ON "ReceiptLine"("organization_id");
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "Role" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "Role_code_key";
DROP INDEX IF EXISTS "Role_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Role_organization_id_code_key" ON "Role"("organization_id", "code");
CREATE INDEX IF NOT EXISTS "Role_organization_id_idx" ON "Role"("organization_id");
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "User" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "User_login_key";
DROP INDEX IF EXISTS "User_login_key";
CREATE UNIQUE INDEX IF NOT EXISTS "User_organization_id_login_key" ON "User"("organization_id", "login");
CREATE INDEX IF NOT EXISTS "User_organization_id_idx" ON "User"("organization_id");
ALTER TABLE "OfflineReceiptQueue" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "OfflineReceiptQueue" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "OfflineReceiptQueue_organization_id_idx" ON "OfflineReceiptQueue"("organization_id");
ALTER TABLE "MarketplaceWebhookEvent" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "MarketplaceWebhookEvent" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "MarketplaceWebhookEvent_organization_id_idx" ON "MarketplaceWebhookEvent"("organization_id");
ALTER TABLE "ProductCache" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "ProductCache" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "ProductCache_sku_key";
DROP INDEX IF EXISTS "ProductCache_sku_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ProductCache_organization_id_sku_key" ON "ProductCache"("organization_id", "sku");
CREATE INDEX IF NOT EXISTS "ProductCache_organization_id_idx" ON "ProductCache"("organization_id");
