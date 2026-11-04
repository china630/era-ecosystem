-- Control Home / topology / grace / billing lines / commercial outlets (2026-11-03)

ALTER TABLE "organization_memberships" ADD COLUMN IF NOT EXISTS "is_home" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "organization_satellite_entitlements" ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMPTZ(6);

DO $$ BEGIN
  CREATE TYPE "BillingLineRatingBasis" AS ENUM ('FULL_MONTH', 'GRACE', 'COVERED', 'SUSPENDED', 'METER', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CommercialOutletStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "billing_invoice_items" ADD COLUMN IF NOT EXISTS "parent_organization_id" UUID;
ALTER TABLE "billing_invoice_items" ADD COLUMN IF NOT EXISTS "satellite_key" TEXT;
ALTER TABLE "billing_invoice_items" ADD COLUMN IF NOT EXISTS "outlet_code" VARCHAR(64);
ALTER TABLE "billing_invoice_items" ADD COLUMN IF NOT EXISTS "catalog_kind" VARCHAR(32);
ALTER TABLE "billing_invoice_items" ADD COLUMN IF NOT EXISTS "module_key" TEXT;
ALTER TABLE "billing_invoice_items" ADD COLUMN IF NOT EXISTS "meter_key" VARCHAR(64);
ALTER TABLE "billing_invoice_items" ADD COLUMN IF NOT EXISTS "period" VARCHAR(7);
ALTER TABLE "billing_invoice_items" ADD COLUMN IF NOT EXISTS "rating_basis" "BillingLineRatingBasis" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "billing_invoice_items" ADD COLUMN IF NOT EXISTS "unit_price" DECIMAL(12,4);
ALTER TABLE "billing_invoice_items" ADD COLUMN IF NOT EXISTS "qty" DECIMAL(12,4);
ALTER TABLE "billing_invoice_items" ADD COLUMN IF NOT EXISTS "price_snapshot" DECIMAL(12,2);

CREATE INDEX IF NOT EXISTS "billing_invoice_items_module_key_idx" ON "billing_invoice_items"("module_key");

CREATE TABLE IF NOT EXISTS "organization_module_graces" (
  "organization_id" UUID NOT NULL,
  "module_key" TEXT NOT NULL,
  "grace_started_at" TIMESTAMPTZ(6),
  "grace_ends_at" TIMESTAMPTZ(6),
  "grace_consumed_at" TIMESTAMPTZ(6),
  "scheduled_enable_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_module_graces_pkey" PRIMARY KEY ("organization_id","module_key")
);
CREATE INDEX IF NOT EXISTS "organization_module_graces_organization_id_idx" ON "organization_module_graces"("organization_id");
DO $$ BEGIN
  ALTER TABLE "organization_module_graces" ADD CONSTRAINT "organization_module_graces_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "commercial_outlets" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "satellite_key" TEXT NOT NULL,
  "code" VARCHAR(64) NOT NULL,
  "name" TEXT NOT NULL,
  "status" "CommercialOutletStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commercial_outlets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "commercial_outlets_organization_id_satellite_key_code_key" ON "commercial_outlets"("organization_id", "satellite_key", "code");
CREATE INDEX IF NOT EXISTS "commercial_outlets_organization_id_satellite_key_idx" ON "commercial_outlets"("organization_id", "satellite_key");
DO $$ BEGIN
  ALTER TABLE "commercial_outlets" ADD CONSTRAINT "commercial_outlets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
