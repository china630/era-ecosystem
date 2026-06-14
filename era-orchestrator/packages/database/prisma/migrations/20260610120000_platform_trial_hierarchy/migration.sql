-- Platform trial hierarchy: satellite entitlements, module trial fields, allowlist flag

ALTER TABLE "organization_subscriptions" ADD COLUMN IF NOT EXISTS "quota_overrides" JSONB;

ALTER TABLE "organization_modules" ADD COLUMN IF NOT EXISTS "trial_expires_at" TIMESTAMPTZ(6);
ALTER TABLE "organization_modules" ADD COLUMN IF NOT EXISTS "trial_overridden" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "pricing_modules" ADD COLUMN IF NOT EXISTS "trial_eligible_in_trial" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "organization_satellite_entitlements" (
    "organization_id" UUID NOT NULL,
    "satellite_key" TEXT NOT NULL,
    "trial_expires_at" TIMESTAMPTZ(6),
    "trial_overridden" BOOLEAN NOT NULL DEFAULT false,
    "connected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_trial" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "organization_satellite_entitlements_pkey" PRIMARY KEY ("organization_id","satellite_key")
);

ALTER TABLE "organization_satellite_entitlements" DROP CONSTRAINT IF EXISTS "organization_satellite_entitlements_organization_id_fkey";
ALTER TABLE "organization_satellite_entitlements" ADD CONSTRAINT "organization_satellite_entitlements_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_satellite_entitlements" DROP CONSTRAINT IF EXISTS "organization_satellite_entitlements_satellite_key_fkey";
ALTER TABLE "organization_satellite_entitlements" ADD CONSTRAINT "organization_satellite_entitlements_satellite_key_fkey"
    FOREIGN KEY ("satellite_key") REFERENCES "satellites"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "organization_satellite_entitlements_organization_id_idx"
    ON "organization_satellite_entitlements"("organization_id");

-- Finance virtual satellite
INSERT INTO "satellites" ("key", "name", "vertical_slug", "sort_order", "updated_at")
VALUES ('finance_core', 'Finance Core', 'finance', 50, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Link finance modules to finance_core satellite
UPDATE "pricing_modules" SET "satellite_key" = 'finance_core'
WHERE "key" IN (
  'nas', 'ifrs', 'ifrs_mapping', 'production', 'manufacturing', 'fixed_assets',
  'inventory', 'hr_full', 'audit_hub', 'cash_bank_pro', 'kassa_pro', 'banking_pro', 'kassa'
) AND ("satellite_key" IS NULL OR "satellite_key" = '');

-- Default platform trial allowlist
UPDATE "pricing_modules" SET "trial_eligible_in_trial" = true
WHERE "key" IN (
  'nas', 'ifrs_mapping', 'manufacturing', 'fixed_assets', 'inventory', 'hr_full', 'audit_hub', 'cash_bank_pro',
  'hotel_core', 'industry_hotel_pms', 'industry_fnb_pos', 'industry_clinic', 'industry_retail',
  'industry_logistics', 'industry_construction', 'industry_crm', 'industry_auto_service', 'industry_wholesale'
);

-- Backfill satellite entitlements from existing activeModules industry gates + finance modules
INSERT INTO "organization_satellite_entitlements" (
  "organization_id", "satellite_key", "trial_expires_at", "trial_overridden", "connected_at", "is_trial"
)
SELECT DISTINCT
  os."organization_id",
  gate AS "satellite_key",
  os."trial_expires_at",
  false,
  COALESCE(os."created_at", CURRENT_TIMESTAMP),
  COALESCE(os."is_trial", true)
FROM "organization_subscriptions" os
CROSS JOIN LATERAL unnest(os."active_modules") AS gate
WHERE gate LIKE 'industry_%'
ON CONFLICT ("organization_id", "satellite_key") DO NOTHING;

INSERT INTO "organization_satellite_entitlements" (
  "organization_id", "satellite_key", "trial_expires_at", "trial_overridden", "connected_at", "is_trial"
)
SELECT DISTINCT
  os."organization_id",
  'finance_core',
  os."trial_expires_at",
  false,
  COALESCE(os."created_at", CURRENT_TIMESTAMP),
  COALESCE(os."is_trial", true)
FROM "organization_subscriptions" os
WHERE os."active_modules" && ARRAY[
  'nas', 'ifrs', 'ifrs_mapping', 'production', 'manufacturing', 'fixed_assets',
  'inventory', 'hr_full', 'audit_hub', 'cash_bank_pro', 'kassa_pro', 'banking_pro', 'kassa'
]::text[]
ON CONFLICT ("organization_id", "satellite_key") DO NOTHING;

-- Backfill module trial dates from org trial for existing active modules
INSERT INTO "organization_modules" ("organization_id", "module_key", "price_snapshot", "trial_expires_at", "trial_overridden")
SELECT
  os."organization_id",
  m AS "module_key",
  0,
  os."trial_expires_at",
  false
FROM "organization_subscriptions" os
CROSS JOIN LATERAL unnest(os."active_modules") AS m
ON CONFLICT ("organization_id", "module_key") DO UPDATE SET
  "trial_expires_at" = EXCLUDED."trial_expires_at"
WHERE "organization_modules"."trial_expires_at" IS NULL;

-- Recalculate org trial end to end-of-month formula for active trials (optional alignment)
UPDATE "organization_subscriptions" os
SET
  "trial_expires_at" = (
    SELECT date_trunc('month', o."created_at" AT TIME ZONE 'Asia/Baku')
      + interval '4 months'
      - interval '1 millisecond'
    FROM "organizations" o
    WHERE o."id" = os."organization_id"
  ),
  "expires_at" = (
    SELECT date_trunc('month', o."created_at" AT TIME ZONE 'Asia/Baku')
      + interval '4 months'
      - interval '1 millisecond'
    FROM "organizations" o
    WHERE o."id" = os."organization_id"
  )
WHERE os."is_trial" = true
  AND os."trial_expires_at" IS NOT NULL;
