ALTER TABLE "ProgramTemplateProcedure" ADD COLUMN IF NOT EXISTS "auto_step" TEXT;
ALTER TABLE "ProgramTemplateProcedure" ADD COLUMN IF NOT EXISTS "included_in_package" BOOLEAN NOT NULL DEFAULT true;

UPDATE "ProgramTemplateProcedure"
SET "auto_step" = 'DOCTOR'
WHERE "auto_step" IS NULL
  AND "assign_mode" = 'AUTO_ON_OPEN'
  AND ("fulfillment" = 'LAB_ORDER' OR "kind" = 'LAB');

UPDATE "ProgramTemplateProcedure"
SET "auto_step" = 'CLINICAL'
WHERE "auto_step" IS NULL
  AND (
    "fulfillment" = 'VISIT'
    OR "kind" = 'EXAM'
    OR "assign_mode" = 'AUTO_DAY1'
  )
  AND "assign_mode" IN ('AUTO_ON_OPEN', 'AUTO_DAY1');

INSERT INTO "ProgramTemplateProcedure" (
  "id", "organizationId", "templateId", "procedureCode", "procedureName",
  "quotaTotal", "kind", "sort_order", "assign_mode", "auto_step", "included_in_package",
  "fulfillment", "fulfillment_explicit", "quota_basis", "requires_doctor"
)
SELECT
  'infectblk_' || substr(md5(t."id"), 1, 20),
  t."organizationId",
  t."id",
  'LAB_INFECT',
  'Biochemistry infection',
  1,
  'LAB',
  900,
  'AUTO_ON_OPEN',
  'CHECKIN',
  CASE WHEN t."code" = 'PKG-PREMIUM' THEN true ELSE false END,
  'LAB_ORDER',
  true,
  'PER_STAY',
  false
FROM "ProgramTemplate" t
WHERE t."is_current" = true
  AND t."code" IN ('PKG-STANDART', 'PKG-PREMIUM', 'PKG-DERMA', 'PKG-DETOKS')
  AND NOT EXISTS (
    SELECT 1 FROM "ProgramTemplateProcedure" p
    WHERE p."templateId" = t."id" AND p."procedureCode" = 'LAB_INFECT'
  );

INSERT INTO "program_template_block_member" (
  "id", "organizationId", "template_id", "block_code", "procedure_code"
)
SELECT
  'infectmem_' || substr(md5(t."id"), 1, 20),
  t."organizationId",
  t."id",
  'LAB_INFECT',
  'LAB-BIOCHEM-INFECT'
FROM "ProgramTemplate" t
WHERE t."is_current" = true
  AND t."code" IN ('PKG-STANDART', 'PKG-PREMIUM', 'PKG-DERMA', 'PKG-DETOKS')
  AND NOT EXISTS (
    SELECT 1 FROM "program_template_block_member" m
    WHERE m."template_id" = t."id"
      AND m."block_code" = 'LAB_INFECT'
      AND m."procedure_code" = 'LAB-BIOCHEM-INFECT'
  );
