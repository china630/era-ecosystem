-- SHARED-schema remainder: leftover catalog roots + composite uniques
CREATE TABLE IF NOT EXISTS "_era_organization_bind" (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  "organizationId" TEXT NOT NULL,
  "boundAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "boundBy" TEXT
);

ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'unbound';
DROP INDEX IF EXISTS "Guest_externalRef_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Guest_organizationId_externalRef_key" ON "Guest"("organizationId", "externalRef");

ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'unbound';
DROP INDEX IF EXISTS "Reservation_externalRef_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Reservation_organizationId_externalRef_key" ON "Reservation"("organizationId", "externalRef");

ALTER TABLE "BusinessDay" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'unbound';
DROP INDEX IF EXISTS "BusinessDay_date_key";
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessDay_organizationId_date_key" ON "BusinessDay"("organizationId", "date");

ALTER TABLE "BanquetMenuPackage" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'unbound';
DROP INDEX IF EXISTS "BanquetMenuPackage_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "BanquetMenuPackage_organizationId_code_key" ON "BanquetMenuPackage"("organizationId", "code");

ALTER TABLE "ChannelStopSell" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "ChannelStopSell" t SET "organizationId" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organizationId") WHERE t."organizationId" = 'unbound';
DROP INDEX IF EXISTS "ChannelStopSell_date_roomTypeId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ChannelStopSell_organizationId_date_roomTypeId_key" ON "ChannelStopSell"("organizationId", "date", "roomTypeId");
CREATE INDEX IF NOT EXISTS "ChannelStopSell_organizationId_idx" ON "ChannelStopSell"("organizationId");

ALTER TABLE "Warehouse" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "Warehouse" t SET "organizationId" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organizationId") WHERE t."organizationId" = 'unbound';
DROP INDEX IF EXISTS "Warehouse_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Warehouse_organizationId_code_key" ON "Warehouse"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "Warehouse_organizationId_idx" ON "Warehouse"("organizationId");

ALTER TABLE "ProductGroup" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "ProductGroup" t SET "organizationId" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organizationId") WHERE t."organizationId" = 'unbound';
DROP INDEX IF EXISTS "ProductGroup_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ProductGroup_organizationId_code_key" ON "ProductGroup"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "ProductGroup_organizationId_idx" ON "ProductGroup"("organizationId");

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "Product" t SET "organizationId" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organizationId") WHERE t."organizationId" = 'unbound';
DROP INDEX IF EXISTS "Product_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Product_organizationId_code_key" ON "Product"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "Product_organizationId_idx" ON "Product"("organizationId");

ALTER TABLE "TransferVehicle" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "TransferVehicle" t SET "organizationId" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organizationId") WHERE t."organizationId" = 'unbound';
DROP INDEX IF EXISTS "TransferVehicle_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "TransferVehicle_organizationId_code_key" ON "TransferVehicle"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "TransferVehicle_organizationId_idx" ON "TransferVehicle"("organizationId");

ALTER TABLE "ConciergeProduct" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "ConciergeProduct" t SET "organizationId" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organizationId") WHERE t."organizationId" = 'unbound';
DROP INDEX IF EXISTS "ConciergeProduct_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ConciergeProduct_organizationId_code_key" ON "ConciergeProduct"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "ConciergeProduct_organizationId_idx" ON "ConciergeProduct"("organizationId");

ALTER TABLE "DispatchVehicle" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "DispatchVehicle" t SET "organizationId" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organizationId") WHERE t."organizationId" = 'unbound';
DROP INDEX IF EXISTS "DispatchVehicle_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "DispatchVehicle_organizationId_code_key" ON "DispatchVehicle"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "DispatchVehicle_organizationId_idx" ON "DispatchVehicle"("organizationId");

ALTER TABLE "YieldRule" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "YieldRule" t SET "organizationId" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organizationId") WHERE t."organizationId" = 'unbound';
CREATE INDEX IF NOT EXISTS "YieldRule_organizationId_idx" ON "YieldRule"("organizationId");

ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "MaintenanceWorkOrder" t SET "organizationId" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organizationId") WHERE t."organizationId" = 'unbound';
CREATE INDEX IF NOT EXISTS "MaintenanceWorkOrder_organizationId_idx" ON "MaintenanceWorkOrder"("organizationId");

ALTER TABLE "RecurringServiceSchedule" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "RecurringServiceSchedule" t SET "organizationId" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organizationId") WHERE t."organizationId" = 'unbound';
CREATE INDEX IF NOT EXISTS "RecurringServiceSchedule_organizationId_idx" ON "RecurringServiceSchedule"("organizationId");

ALTER TABLE "PricingComponent" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "PricingComponent" t SET "organizationId" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organizationId") WHERE t."organizationId" = 'unbound';
DROP INDEX IF EXISTS "PricingComponent_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PricingComponent_organizationId_code_key" ON "PricingComponent"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "PricingComponent_organizationId_idx" ON "PricingComponent"("organizationId");
