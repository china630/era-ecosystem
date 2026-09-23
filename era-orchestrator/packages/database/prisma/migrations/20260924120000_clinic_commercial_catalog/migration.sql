-- Commercial clinic catalog: 7 paid SKUs, rewrite stored entitlements, drop retired keys.
-- Public pricing reads this table and does not run the rewrite itself.

INSERT INTO "satellites" ("key", "name", "vertical_slug", "sort_order", "updated_at")
VALUES ('industry_clinic', 'Clinic', 'clinic', 107, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "pricing_modules" (
  "id", "key", "name", "price_per_month", "is_premium", "sort_order",
  "catalog_kind", "satellite_key", "trial_eligible_in_trial", "updated_at"
)
SELECT uuid_generate_v4(), v.key, v.name, v.price_per_month, false, v.sort_order,
       'MODULE', 'industry_clinic', true, CURRENT_TIMESTAMP
FROM (VALUES
  ('clinic_lab', 'Laboratory', 29::numeric, 205),
  ('clinic_insurance', 'Insurance / DMS eligibility', 39::numeric, 212),
  ('clinic_inpatient', 'Inpatient / bed management', 39::numeric, 213),
  ('clinic_telehealth', 'Telehealth', 39::numeric, 214),
  ('clinic_nurse_roster', 'Nurse roster / procedure post', 19::numeric, 215),
  ('clinic_registry_emr', 'EMR / visit protocols', 39::numeric, 216),
  ('clinic_sanatorium', 'Sanatorium chart', 99::numeric, 217)
) AS v(key, name, price_per_month, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM "pricing_modules" pm WHERE pm."key" = v.key
);

UPDATE "pricing_modules" AS pm
SET
  "name" = v.name,
  "price_per_month" = v.price_per_month,
  "sort_order" = v.sort_order,
  "is_premium" = false,
  "catalog_kind" = 'MODULE',
  "satellite_key" = 'industry_clinic',
  "trial_eligible_in_trial" = true,
  "updated_at" = CURRENT_TIMESTAMP
FROM (VALUES
  ('clinic_lab', 'Laboratory', 29::numeric, 205),
  ('clinic_insurance', 'Insurance / DMS eligibility', 39::numeric, 212),
  ('clinic_inpatient', 'Inpatient / bed management', 39::numeric, 213),
  ('clinic_telehealth', 'Telehealth', 39::numeric, 214),
  ('clinic_nurse_roster', 'Nurse roster / procedure post', 19::numeric, 215),
  ('clinic_registry_emr', 'EMR / visit protocols', 39::numeric, 216),
  ('clinic_sanatorium', 'Sanatorium chart', 99::numeric, 217)
) AS v(key, name, price_per_month, sort_order)
WHERE pm."key" = v.key;

-- organization_modules: rename successors, then drop retired keys.
UPDATE "organization_modules" AS om
SET "module_key" = 'clinic_sanatorium'
WHERE om."module_key" = 'clinic_sanatorium_clinical'
  AND NOT EXISTS (
    SELECT 1 FROM "organization_modules" x
    WHERE x."organization_id" = om."organization_id"
      AND x."module_key" = 'clinic_sanatorium'
  );

INSERT INTO "organization_modules" (
  "organization_id", "module_key", "price_snapshot", "activated_at",
  "pending_deactivation", "cancelled_at", "access_until",
  "trial_expires_at", "trial_overridden"
)
SELECT DISTINCT ON (om."organization_id")
  om."organization_id", 'clinic_registry_emr', om."price_snapshot", om."activated_at",
  om."pending_deactivation", om."cancelled_at", om."access_until",
  om."trial_expires_at", om."trial_overridden"
FROM "organization_modules" om
WHERE om."module_key" IN ('clinic_patients', 'clinic_visit', 'clinic_ehr', 'clinic_reschedule')
  AND NOT EXISTS (
    SELECT 1 FROM "organization_modules" x
    WHERE x."organization_id" = om."organization_id"
      AND x."module_key" = 'clinic_registry_emr'
  )
ORDER BY om."organization_id", om."activated_at";

INSERT INTO "organization_modules" (
  "organization_id", "module_key", "price_snapshot", "activated_at",
  "pending_deactivation", "cancelled_at", "access_until",
  "trial_expires_at", "trial_overridden"
)
SELECT
  om."organization_id", 'clinic_lab', om."price_snapshot", om."activated_at",
  om."pending_deactivation", om."cancelled_at", om."access_until",
  om."trial_expires_at", om."trial_overridden"
FROM "organization_modules" om
WHERE om."module_key" = 'clinic_lis_import'
  AND NOT EXISTS (
    SELECT 1 FROM "organization_modules" x
    WHERE x."organization_id" = om."organization_id"
      AND x."module_key" = 'clinic_lab'
  );

DELETE FROM "organization_modules"
WHERE "module_key" IN (
  'clinic_shell',
  'clinic_schedule',
  'clinic_appointments',
  'clinic_service_catalog',
  'clinic_patients',
  'clinic_visit',
  'clinic_ehr',
  'clinic_reschedule',
  'clinic_lis_import',
  'clinic_portal',
  'clinic_notifications',
  'clinic_sanatorium_clinical'
);

-- active_modules arrays: add successor keys, then drop retired ones.
UPDATE "organizations" AS o
SET "active_modules" = (
  SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::text[])
  FROM (
    SELECT m AS x
    FROM unnest(o."active_modules") AS m
    WHERE m <> ALL (ARRAY[
      'clinic_shell', 'clinic_schedule', 'clinic_appointments', 'clinic_service_catalog',
      'clinic_patients', 'clinic_visit', 'clinic_ehr', 'clinic_reschedule',
      'clinic_lis_import', 'clinic_portal', 'clinic_notifications', 'clinic_sanatorium_clinical'
    ]::text[])
    UNION
    SELECT 'clinic_sanatorium'
    WHERE 'clinic_sanatorium_clinical' = ANY (o."active_modules")
    UNION
    SELECT 'clinic_registry_emr'
    WHERE o."active_modules" && ARRAY['clinic_patients', 'clinic_visit', 'clinic_ehr', 'clinic_reschedule']::text[]
    UNION
    SELECT 'clinic_lab'
    WHERE 'clinic_lis_import' = ANY (o."active_modules")
  ) s
)
WHERE o."active_modules" && ARRAY[
  'clinic_shell', 'clinic_schedule', 'clinic_appointments', 'clinic_service_catalog',
  'clinic_patients', 'clinic_visit', 'clinic_ehr', 'clinic_reschedule',
  'clinic_lis_import', 'clinic_portal', 'clinic_notifications', 'clinic_sanatorium_clinical'
]::text[];

UPDATE "organization_subscriptions" AS o
SET "active_modules" = (
  SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::text[])
  FROM (
    SELECT m AS x
    FROM unnest(o."active_modules") AS m
    WHERE m <> ALL (ARRAY[
      'clinic_shell', 'clinic_schedule', 'clinic_appointments', 'clinic_service_catalog',
      'clinic_patients', 'clinic_visit', 'clinic_ehr', 'clinic_reschedule',
      'clinic_lis_import', 'clinic_portal', 'clinic_notifications', 'clinic_sanatorium_clinical'
    ]::text[])
    UNION
    SELECT 'clinic_sanatorium'
    WHERE 'clinic_sanatorium_clinical' = ANY (o."active_modules")
    UNION
    SELECT 'clinic_registry_emr'
    WHERE o."active_modules" && ARRAY['clinic_patients', 'clinic_visit', 'clinic_ehr', 'clinic_reschedule']::text[]
    UNION
    SELECT 'clinic_lab'
    WHERE 'clinic_lis_import' = ANY (o."active_modules")
  ) s
)
WHERE o."active_modules" && ARRAY[
  'clinic_shell', 'clinic_schedule', 'clinic_appointments', 'clinic_service_catalog',
  'clinic_patients', 'clinic_visit', 'clinic_ehr', 'clinic_reschedule',
  'clinic_lis_import', 'clinic_portal', 'clinic_notifications', 'clinic_sanatorium_clinical'
]::text[];

UPDATE "tenant_billing" AS o
SET "active_modules" = (
  SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::text[])
  FROM (
    SELECT m AS x
    FROM unnest(o."active_modules") AS m
    WHERE m <> ALL (ARRAY[
      'clinic_shell', 'clinic_schedule', 'clinic_appointments', 'clinic_service_catalog',
      'clinic_patients', 'clinic_visit', 'clinic_ehr', 'clinic_reschedule',
      'clinic_lis_import', 'clinic_portal', 'clinic_notifications', 'clinic_sanatorium_clinical'
    ]::text[])
    UNION
    SELECT 'clinic_sanatorium'
    WHERE 'clinic_sanatorium_clinical' = ANY (o."active_modules")
    UNION
    SELECT 'clinic_registry_emr'
    WHERE o."active_modules" && ARRAY['clinic_patients', 'clinic_visit', 'clinic_ehr', 'clinic_reschedule']::text[]
    UNION
    SELECT 'clinic_lab'
    WHERE 'clinic_lis_import' = ANY (o."active_modules")
  ) s
)
WHERE o."active_modules" && ARRAY[
  'clinic_shell', 'clinic_schedule', 'clinic_appointments', 'clinic_service_catalog',
  'clinic_patients', 'clinic_visit', 'clinic_ehr', 'clinic_reschedule',
  'clinic_lis_import', 'clinic_portal', 'clinic_notifications', 'clinic_sanatorium_clinical'
]::text[];

-- Trial and constructor plans authorize from custom_config.modules, not active_modules.
UPDATE "organization_subscriptions" AS o
SET "custom_config" = jsonb_set(
  o."custom_config",
  '{modules}',
  (
    SELECT COALESCE(jsonb_agg(DISTINCT to_jsonb(x)), '[]'::jsonb)
    FROM (
      SELECT m AS x
      FROM jsonb_array_elements_text(o."custom_config" -> 'modules') AS m
      WHERE m <> ALL (ARRAY[
        'clinic_shell', 'clinic_schedule', 'clinic_appointments', 'clinic_service_catalog',
        'clinic_patients', 'clinic_visit', 'clinic_ehr', 'clinic_reschedule',
        'clinic_lis_import', 'clinic_portal', 'clinic_notifications', 'clinic_sanatorium_clinical'
      ]::text[])
      UNION
      SELECT 'clinic_sanatorium'
      WHERE o."custom_config" -> 'modules' ? 'clinic_sanatorium_clinical'
      UNION
      SELECT 'clinic_registry_emr'
      WHERE o."custom_config" -> 'modules' ?| ARRAY['clinic_patients', 'clinic_visit', 'clinic_ehr', 'clinic_reschedule']::text[]
      UNION
      SELECT 'clinic_lab'
      WHERE o."custom_config" -> 'modules' ? 'clinic_lis_import'
    ) s
  )
)
WHERE jsonb_typeof(o."custom_config" -> 'modules') = 'array'
  AND o."custom_config" -> 'modules' ?| ARRAY[
    'clinic_shell', 'clinic_schedule', 'clinic_appointments', 'clinic_service_catalog',
    'clinic_patients', 'clinic_visit', 'clinic_ehr', 'clinic_reschedule',
    'clinic_lis_import', 'clinic_portal', 'clinic_notifications', 'clinic_sanatorium_clinical'
  ]::text[];

UPDATE "pricing_bundles" AS b
SET "module_keys" = (
  SELECT COALESCE(jsonb_agg(DISTINCT to_jsonb(x)), '[]'::jsonb)
  FROM (
    SELECT m AS x
    FROM jsonb_array_elements_text(b."module_keys") AS m
    WHERE m <> ALL (ARRAY[
      'clinic_shell', 'clinic_schedule', 'clinic_appointments', 'clinic_service_catalog',
      'clinic_patients', 'clinic_visit', 'clinic_ehr', 'clinic_reschedule',
      'clinic_lis_import', 'clinic_portal', 'clinic_notifications', 'clinic_sanatorium_clinical'
    ]::text[])
    UNION
    SELECT 'clinic_sanatorium'
    WHERE b."module_keys" ? 'clinic_sanatorium_clinical'
    UNION
    SELECT 'clinic_registry_emr'
    WHERE b."module_keys" ?| ARRAY['clinic_patients', 'clinic_visit', 'clinic_ehr', 'clinic_reschedule']::text[]
    UNION
    SELECT 'clinic_lab'
    WHERE b."module_keys" ? 'clinic_lis_import'
  ) s
)
WHERE jsonb_typeof(b."module_keys") = 'array'
  AND b."module_keys" ?| ARRAY[
    'clinic_shell', 'clinic_schedule', 'clinic_appointments', 'clinic_service_catalog',
    'clinic_patients', 'clinic_visit', 'clinic_ehr', 'clinic_reschedule',
    'clinic_lis_import', 'clinic_portal', 'clinic_notifications', 'clinic_sanatorium_clinical'
  ]::text[];

DELETE FROM "pricing_modules"
WHERE "key" IN (
  'clinic_shell',
  'clinic_schedule',
  'clinic_appointments',
  'clinic_service_catalog',
  'clinic_patients',
  'clinic_visit',
  'clinic_ehr',
  'clinic_reschedule',
  'clinic_lis_import',
  'clinic_portal',
  'clinic_notifications',
  'clinic_sanatorium_clinical'
);
