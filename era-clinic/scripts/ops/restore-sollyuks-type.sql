-- Recreate SVC-SOLLYUKS after the twin existed alone and was dropped.
-- Points leftover SVC-SOLYUKS orders at the new type. Restores Esmira skill + October duty.

BEGIN;

INSERT INTO "ProcedureType" (
  id, "organizationId", code, name, "durationMin",
  resource_gap_minutes, patient_rest_minutes, "resourceKind", "resourceCode",
  "bodyPart", "afterLunchAllowed", before_lunch_allowed,
  day_start_hour, day_end_hour, extended_end_hour,
  needs_site, physio_order_fields, allowed_site_codes,
  finance_sku, hotel_revenue_code
)
SELECT
  'pt_sollyuks_' || substr(md5(random()::text), 1, 12),
  a."organizationId",
  'SVC-SOLLYUKS',
  'Sollyuks',
  20,
  a.resource_gap_minutes,
  a.patient_rest_minutes,
  'ROOM',
  NULL,
  a."bodyPart",
  true,
  true,
  a.day_start_hour,
  a.day_end_hour,
  a.extended_end_hour,
  true,
  a.physio_order_fields,
  a.allowed_site_codes,
  a.finance_sku,
  a.hotel_revenue_code
FROM "ProcedureType" a
WHERE a.code = 'SVC-AMPLIPULS'
  AND NOT EXISTS (SELECT 1 FROM "ProcedureType" t WHERE t."organizationId" = a."organizationId" AND t.code = 'SVC-SOLLYUKS');

INSERT INTO procedure_type_requirement (
  id, procedure_type_id, role, resource_kind, resource_code, quantity, staff_mode, required, created_at, "organizationId"
)
SELECT
  'rq_sollyuks_' || cabin || '_' || substr(md5(random()::text), 1, 8),
  t.id,
  'LOCATION',
  'ROOM',
  cabin,
  1,
  'HARD',
  true,
  NOW(),
  t."organizationId"
FROM "ProcedureType" t
CROSS JOIN unnest(ARRAY['WO-ROOM-2', 'WO-ROOM-3', 'WO-ROOM-21', 'WO-ROOM-22']) AS cabin
WHERE t.code = 'SVC-SOLLYUKS'
  AND NOT EXISTS (
    SELECT 1 FROM procedure_type_requirement r
    WHERE r.procedure_type_id = t.id AND r.resource_code = cabin
  );

INSERT INTO procedure_type_requirement (
  id, procedure_type_id, role, resource_kind, resource_code, quantity, staff_mode, required, created_at, "organizationId"
)
SELECT
  'rq_sollyuks_staff_' || substr(md5(random()::text), 1, 8),
  t.id,
  'STAFF',
  NULL,
  NULL,
  1,
  'SOFT',
  true,
  NOW(),
  t."organizationId"
FROM "ProcedureType" t
WHERE t.code = 'SVC-SOLLYUKS'
  AND NOT EXISTS (
    SELECT 1 FROM procedure_type_requirement r
    WHERE r.procedure_type_id = t.id AND r.role = 'STAFF'
  );

INSERT INTO "ServiceCatalogCache" (
  id, "organizationId", code, description, description_az, description_ru, description_en,
  amount, package_included, department, kind, "syncedAt", list_amount, department_code, hotel_revenue_code
)
SELECT
  'cat_sollyuks_' || substr(md5(random()::text), 1, 12),
  c."organizationId",
  'SVC-SOLLYUKS',
  'Соллюкс',
  'Sollyuks',
  'Соллюкс',
  'Sollux lamp therapy',
  14,
  false,
  c.department,
  c.kind,
  NOW(),
  14,
  c.department_code,
  c.hotel_revenue_code
FROM "ServiceCatalogCache" c
WHERE c.code = 'SVC-AMPLIPULS'
  AND NOT EXISTS (
    SELECT 1 FROM "ServiceCatalogCache" x
    WHERE x."organizationId" = c."organizationId" AND x.code = 'SVC-SOLLYUKS'
  );

UPDATE "ProcedureOrder" o
SET
  "procedureCode" = 'SVC-SOLLYUKS',
  "procedureName" = 'Sollyuks',
  "procedureTypeId" = t.id
FROM "ProcedureType" t
WHERE t.code = 'SVC-SOLLYUKS'
  AND t."organizationId" = o."organizationId"
  AND (o."procedureCode" = 'SVC-SOLYUKS' OR o."procedureTypeId" IS NULL AND o."procedureCode" ILIKE '%SOL%YUK%');

UPDATE "ProcedureOrder"
SET package_quota_code = 'SVC-SOLLYUKS'
WHERE package_quota_code = 'SVC-SOLYUKS';

INSERT INTO practitioner_skill (id, "organizationId", practitioner_id, procedure_type_id, active, created_at)
SELECT
  'sk_sollyuks_' || substr(md5(random()::text), 1, 10),
  p."organizationId",
  p.id,
  t.id,
  true,
  NOW()
FROM "Practitioner" p
JOIN "ProcedureType" t ON t."organizationId" = p."organizationId" AND t.code = 'SVC-SOLLYUKS'
WHERE p.code = '6250EC4A'
  AND NOT EXISTS (
    SELECT 1 FROM practitioner_skill s
    WHERE s.practitioner_id = p.id AND s.procedure_type_id = t.id
  );

INSERT INTO staff_duty_line (
  id, "organizationId", roster_id, procedure_type_id, practitioner_id, stable, sort_order, note, created_at
)
SELECT
  'dl_sollyuks_' || r.year_month || '_' || substr(md5(random()::text), 1, 8),
  r."organizationId",
  r.id,
  t.id,
  p.id,
  true,
  0,
  NULL,
  NOW()
FROM staff_duty_roster r
JOIN "ProcedureType" t ON t."organizationId" = r."organizationId" AND t.code = 'SVC-SOLLYUKS'
JOIN "Practitioner" p ON p."organizationId" = r."organizationId" AND p.code = '6250EC4A'
WHERE r.staff_kind = 'NURSE'
  AND r.year_month IN ('2026-10', '2026-11')
  AND NOT EXISTS (
    SELECT 1 FROM staff_duty_line l
    WHERE l.roster_id = r.id AND l.procedure_type_id = t.id AND l.practitioner_id = p.id
  );

COMMIT;
