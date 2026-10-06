-- Three Workforce packages. Orgs that already have the hub keep the full contour (Premium).
-- New sales start on Essential via applyCatalogMutex when only platform_workforce is toggled.

INSERT INTO "pricing_modules" (
  "id", "key", "name", "price_per_month", "is_premium", "sort_order",
  "catalog_kind", "trial_eligible_in_trial", "updated_at"
)
SELECT uuid_generate_v4(), 'platform_workforce_premium',
       'Workforce Premium (6 AZN / person)', 0, false, 33,
       'ADDON', true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "pricing_modules" pm WHERE pm."key" = 'platform_workforce_premium'
);

UPDATE "pricing_modules"
SET "name" = 'Workforce Essential (2 AZN / person)', "price_per_month" = 0, "updated_at" = CURRENT_TIMESTAMP
WHERE "key" = 'platform_workforce_base';

UPDATE "pricing_modules"
SET "name" = 'Workforce Professional (4 AZN / person)', "price_per_month" = 0, "updated_at" = CURRENT_TIMESTAMP
WHERE "key" = 'platform_workforce_pro';

-- Grandfather stored module arrays: drop Base/PRO, add Premium + hub.
UPDATE "organization_subscriptions" AS o
SET "active_modules" = (
  SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::text[])
  FROM (
    SELECT m AS x
    FROM unnest(o."active_modules") AS m
    WHERE m <> ALL (ARRAY['platform_workforce_base', 'platform_workforce_pro']::text[])
    UNION
    SELECT 'platform_workforce_premium'
    WHERE o."active_modules" && ARRAY['platform_workforce', 'platform_workforce_base', 'platform_workforce_pro']::text[]
    UNION
    SELECT 'platform_workforce'
    WHERE o."active_modules" && ARRAY['platform_workforce', 'platform_workforce_base', 'platform_workforce_pro']::text[]
  ) s
)
WHERE o."active_modules" && ARRAY['platform_workforce', 'platform_workforce_base', 'platform_workforce_pro']::text[];

UPDATE "organizations" AS o
SET "active_modules" = (
  SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::text[])
  FROM (
    SELECT m AS x
    FROM unnest(o."active_modules") AS m
    WHERE m <> ALL (ARRAY['platform_workforce_base', 'platform_workforce_pro']::text[])
    UNION
    SELECT 'platform_workforce_premium'
    WHERE o."active_modules" && ARRAY['platform_workforce', 'platform_workforce_base', 'platform_workforce_pro']::text[]
    UNION
    SELECT 'platform_workforce'
    WHERE o."active_modules" && ARRAY['platform_workforce', 'platform_workforce_base', 'platform_workforce_pro']::text[]
  ) s
)
WHERE o."active_modules" && ARRAY['platform_workforce', 'platform_workforce_base', 'platform_workforce_pro']::text[];

UPDATE "tenant_billing" AS o
SET "active_modules" = (
  SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::text[])
  FROM (
    SELECT m AS x
    FROM unnest(o."active_modules") AS m
    WHERE m <> ALL (ARRAY['platform_workforce_base', 'platform_workforce_pro']::text[])
    UNION
    SELECT 'platform_workforce_premium'
    WHERE o."active_modules" && ARRAY['platform_workforce', 'platform_workforce_base', 'platform_workforce_pro']::text[]
    UNION
    SELECT 'platform_workforce'
    WHERE o."active_modules" && ARRAY['platform_workforce', 'platform_workforce_base', 'platform_workforce_pro']::text[]
  ) s
)
WHERE o."active_modules" && ARRAY['platform_workforce', 'platform_workforce_base', 'platform_workforce_pro']::text[];

INSERT INTO "organization_modules" (
  "organization_id", "module_key", "price_snapshot", "activated_at",
  "pending_deactivation", "trial_overridden"
)
SELECT DISTINCT ON (om."organization_id")
  om."organization_id", 'platform_workforce_premium', 0, om."activated_at", false, false
FROM "organization_modules" om
WHERE om."module_key" IN ('platform_workforce', 'platform_workforce_base', 'platform_workforce_pro')
  AND NOT EXISTS (
    SELECT 1 FROM "organization_modules" x
    WHERE x."organization_id" = om."organization_id"
      AND x."module_key" = 'platform_workforce_premium'
  )
ORDER BY om."organization_id", om."activated_at";

DELETE FROM "organization_modules"
WHERE "module_key" IN ('platform_workforce_base', 'platform_workforce_pro')
  AND "organization_id" IN (
    SELECT "organization_id" FROM "organization_modules" WHERE "module_key" = 'platform_workforce_premium'
  );
