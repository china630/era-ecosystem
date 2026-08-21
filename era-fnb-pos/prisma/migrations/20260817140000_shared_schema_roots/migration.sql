-- SHARED-schema: additive organizationId on tenant roots
CREATE TABLE IF NOT EXISTS "_era_organization_bind" (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  "organizationId" TEXT NOT NULL,
  "boundAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "boundBy" TEXT
);
ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "outlets" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "Outlet_code_key";
DROP INDEX IF EXISTS "outlets_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "outlets_organization_id_code_key" ON "outlets"("organization_id", "code");
CREATE INDEX IF NOT EXISTS "outlets_organization_id_idx" ON "outlets"("organization_id");
ALTER TABLE "delivery_inbox_orders" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "delivery_inbox_orders" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "DeliveryInboxOrder_externalRef_key";
DROP INDEX IF EXISTS "delivery_inbox_orders_external_ref_key";
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_inbox_orders_organization_id_external_ref_key" ON "delivery_inbox_orders"("organization_id", "external_ref");
CREATE INDEX IF NOT EXISTS "delivery_inbox_orders_organization_id_idx" ON "delivery_inbox_orders"("organization_id");
ALTER TABLE "pos_tables" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "pos_tables" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "pos_tables_organization_id_idx" ON "pos_tables"("organization_id");
ALTER TABLE "table_reservations" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "table_reservations" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "table_reservations_organization_id_idx" ON "table_reservations"("organization_id");
ALTER TABLE "menu_categories" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "menu_categories" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "menu_categories_organization_id_idx" ON "menu_categories"("organization_id");
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "menu_items" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "menu_items_organization_id_idx" ON "menu_items"("organization_id");
ALTER TABLE "pos_shifts" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "pos_shifts" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "pos_shifts_organization_id_idx" ON "pos_shifts"("organization_id");
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "tickets" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "tickets_organization_id_idx" ON "tickets"("organization_id");
ALTER TABLE "staff_rosters" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "staff_rosters" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "StaffRoster_staffCode_key";
DROP INDEX IF EXISTS "staff_rosters_staff_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "staff_rosters_organization_id_staff_code_key" ON "staff_rosters"("organization_id", "staff_code");
CREATE INDEX IF NOT EXISTS "staff_rosters_organization_id_idx" ON "staff_rosters"("organization_id");
ALTER TABLE "pin_clock_events" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "pin_clock_events" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "pin_clock_events_organization_id_idx" ON "pin_clock_events"("organization_id");
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "roles" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "Role_code_key";
DROP INDEX IF EXISTS "roles_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "roles_organization_id_code_key" ON "roles"("organization_id", "code");
CREATE INDEX IF NOT EXISTS "roles_organization_id_idx" ON "roles"("organization_id");
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "users" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "User_login_key";
DROP INDEX IF EXISTS "users_login_key";
CREATE UNIQUE INDEX IF NOT EXISTS "users_organization_id_login_key" ON "users"("organization_id", "login");
CREATE INDEX IF NOT EXISTS "users_organization_id_idx" ON "users"("organization_id");
ALTER TABLE "satellite_audit_logs" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "satellite_audit_logs" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "satellite_audit_logs_organization_id_idx" ON "satellite_audit_logs"("organization_id");
