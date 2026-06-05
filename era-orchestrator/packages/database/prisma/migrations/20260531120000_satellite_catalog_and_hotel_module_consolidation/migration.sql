-- Satellite catalog + pricing_modules.catalog_kind + hotel module key consolidation

CREATE TYPE "PricingCatalogKind" AS ENUM ('SATELLITE', 'MODULE', 'ADDON');

CREATE TABLE "satellites" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vertical_slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "satellites_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "pricing_modules" ADD COLUMN "catalog_kind" "PricingCatalogKind" NOT NULL DEFAULT 'MODULE';
ALTER TABLE "pricing_modules" ADD COLUMN "satellite_key" TEXT;

ALTER TABLE "pricing_modules" ADD CONSTRAINT "pricing_modules_satellite_key_fkey"
    FOREIGN KEY ("satellite_key") REFERENCES "satellites"("key") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "pricing_modules_catalog_kind_idx" ON "pricing_modules"("catalog_kind");
CREATE INDEX "pricing_modules_satellite_key_idx" ON "pricing_modules"("satellite_key");

-- Seed industry satellites
INSERT INTO "satellites" ("key", "name", "vertical_slug", "sort_order", "updated_at") VALUES
  ('industry_hotel_pms', 'Hotel PMS', 'hotel', 100, CURRENT_TIMESTAMP),
  ('industry_fnb_pos', 'F&B POS', 'fnb', 101, CURRENT_TIMESTAMP),
  ('industry_retail', 'Retail POS', 'retail', 102, CURRENT_TIMESTAMP),
  ('industry_logistics', 'Logistics', 'logistics', 103, CURRENT_TIMESTAMP),
  ('industry_construction', 'Construction', 'construction', 104, CURRENT_TIMESTAMP),
  ('industry_crm', 'CRM Field', 'crm', 105, CURRENT_TIMESTAMP),
  ('industry_auto_service', 'Auto STO', 'auto', 106, CURRENT_TIMESTAMP),
  ('industry_clinic', 'Clinic', 'clinic', 107, CURRENT_TIMESTAMP),
  ('industry_wholesale', 'Wholesale', 'wholesale', 108, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Backfill catalog_kind from key prefix
UPDATE "pricing_modules" SET "catalog_kind" = 'SATELLITE' WHERE "key" LIKE 'industry_%';
UPDATE "pricing_modules" SET "catalog_kind" = 'ADDON' WHERE "key" LIKE 'platform_%';
UPDATE "pricing_modules" SET "catalog_kind" = 'ADDON' WHERE "is_premium" = true AND "key" NOT LIKE 'hotel_%' AND "key" NOT LIKE 'industry_%';
UPDATE "pricing_modules" SET "satellite_key" = 'industry_hotel_pms' WHERE "key" LIKE 'hotel_%';

-- Consolidate legacy hotel module keys -> new 9-key taxonomy
UPDATE "pricing_modules" SET "key" = 'hotel_core', "name" = 'PMS Core (Front Office, Front Cash, Night Audit)', "price_per_month" = 24
WHERE "key" = 'hotel_front_office';

DELETE FROM "pricing_modules" WHERE "key" IN ('hotel_front_cash', 'hotel_night_audit');

UPDATE "pricing_modules" SET "key" = 'hotel_distribution', "name" = 'Distribution (Channel Manager & Contracts)', "price_per_month" = 27
WHERE "key" = 'hotel_channel_ota';

DELETE FROM "pricing_modules" WHERE "key" = 'hotel_contracts_yield';

-- Insert consolidated keys if absent (fresh DBs that never had legacy rows)
INSERT INTO "pricing_modules" ("id", "key", "name", "price_per_month", "is_premium", "sort_order", "catalog_kind", "satellite_key", "updated_at")
SELECT uuid_generate_v4(), 'hotel_core', 'PMS Core (Front Office, Front Cash, Night Audit)', 24, false, 110, 'MODULE', 'industry_hotel_pms', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "pricing_modules" WHERE "key" = 'hotel_core');

INSERT INTO "pricing_modules" ("id", "key", "name", "price_per_month", "is_premium", "sort_order", "catalog_kind", "satellite_key", "updated_at")
SELECT uuid_generate_v4(), 'hotel_distribution', 'Distribution (Channel Manager & Contracts)', 27, true, 114, 'MODULE', 'industry_hotel_pms', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "pricing_modules" WHERE "key" = 'hotel_distribution');

-- Organization active_modules consolidation
UPDATE "organizations" SET "active_modules" = (
  SELECT COALESCE(array_agg(DISTINCT m), ARRAY[]::text[])
  FROM unnest("active_modules") AS m
  WHERE m NOT IN ('hotel_front_office', 'hotel_front_cash', 'hotel_night_audit', 'hotel_channel_ota', 'hotel_contracts_yield')
) || CASE WHEN 'hotel_front_office' = ANY("active_modules") OR 'hotel_front_cash' = ANY("active_modules") OR 'hotel_night_audit' = ANY("active_modules")
  THEN ARRAY['hotel_core'] ELSE ARRAY[]::text[] END
  || CASE WHEN 'hotel_channel_ota' = ANY("active_modules") OR 'hotel_contracts_yield' = ANY("active_modules")
  THEN ARRAY['hotel_distribution'] ELSE ARRAY[]::text[] END;

UPDATE "organization_subscriptions" SET "active_modules" = (
  SELECT COALESCE(array_agg(DISTINCT m), ARRAY[]::text[])
  FROM unnest("active_modules") AS m
  WHERE m NOT IN ('hotel_front_office', 'hotel_front_cash', 'hotel_night_audit', 'hotel_channel_ota', 'hotel_contracts_yield')
) || CASE WHEN 'hotel_front_office' = ANY("active_modules") OR 'hotel_front_cash' = ANY("active_modules") OR 'hotel_night_audit' = ANY("active_modules")
  THEN ARRAY['hotel_core'] ELSE ARRAY[]::text[] END
  || CASE WHEN 'hotel_channel_ota' = ANY("active_modules") OR 'hotel_contracts_yield' = ANY("active_modules")
  THEN ARRAY['hotel_distribution'] ELSE ARRAY[]::text[] END;

UPDATE "tenant_billing" SET "active_modules" = (
  SELECT COALESCE(array_agg(DISTINCT m), ARRAY[]::text[])
  FROM unnest("active_modules") AS m
  WHERE m NOT IN ('hotel_front_office', 'hotel_front_cash', 'hotel_night_audit', 'hotel_channel_ota', 'hotel_contracts_yield')
) || CASE WHEN 'hotel_front_office' = ANY("active_modules") OR 'hotel_front_cash' = ANY("active_modules") OR 'hotel_night_audit' = ANY("active_modules")
  THEN ARRAY['hotel_core'] ELSE ARRAY[]::text[] END
  || CASE WHEN 'hotel_channel_ota' = ANY("active_modules") OR 'hotel_contracts_yield' = ANY("active_modules")
  THEN ARRAY['hotel_distribution'] ELSE ARRAY[]::text[] END;

-- organization_modules key remap
UPDATE "organization_modules" SET "module_key" = 'hotel_core'
WHERE "module_key" IN ('hotel_front_office', 'hotel_front_cash', 'hotel_night_audit');

UPDATE "organization_modules" SET "module_key" = 'hotel_distribution'
WHERE "module_key" IN ('hotel_channel_ota', 'hotel_contracts_yield');

-- Dedupe organization_modules after remap
DELETE FROM "organization_modules" a
USING "organization_modules" b
WHERE a."organization_id" = b."organization_id"
  AND a."module_key" = b."module_key"
  AND a.ctid < b.ctid;

-- Pricing bundles module_keys JSON
UPDATE "pricing_bundles" SET "module_keys" = (
  SELECT jsonb_agg(DISTINCT elem)
  FROM (
    SELECT CASE
      WHEN elem IN ('hotel_front_office', 'hotel_front_cash', 'hotel_night_audit') THEN 'hotel_core'
      WHEN elem IN ('hotel_channel_ota', 'hotel_contracts_yield') THEN 'hotel_distribution'
      ELSE elem
    END AS elem
    FROM jsonb_array_elements_text("module_keys"::jsonb) AS elem
    WHERE elem NOT IN ('hotel_front_cash', 'hotel_night_audit', 'hotel_contracts_yield')
  ) sub
)::json;
