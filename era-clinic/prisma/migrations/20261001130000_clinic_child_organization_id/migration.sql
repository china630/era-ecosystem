-- Clinic tenant column matches hotel: Postgres "organizationId" (not organization_id).
-- Child/line rows copy the parent org. Fail if any row stays null. Do not stamp one org onto the whole table.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'organization_id'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I RENAME COLUMN organization_id TO %I',
      r.table_name,
      'organizationId'
    );
  END LOOP;
END $$;

-- Index names follow the column. Postgres renames a backing UNIQUE/PK constraint with the index.
-- Skip hotel_organization_id (different column).
DO $$
DECLARE
  r record;
  new_name text;
BEGIN
  FOR r IN
    SELECT c.relname AS index_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'i'
      AND c.relname LIKE '%organization_id%'
      AND c.relname NOT LIKE '%hotel_organization_id%'
  LOOP
    new_name := replace(r.index_name, 'organization_id', 'organizationId');
    IF new_name <> r.index_name THEN
      EXECUTE format('ALTER INDEX %I RENAME TO %I', r.index_name, new_name);
    END IF;
  END LOOP;
END $$;

-- VisitServiceLine ← Visit
ALTER TABLE "VisitServiceLine" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "VisitServiceLine" AS c
SET "organizationId" = p."organizationId"
FROM "Visit" AS p
WHERE c."visitId" = p.id
  AND c."organizationId" IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "VisitServiceLine" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'VisitServiceLine: organizationId backfill left null rows';
  END IF;
END $$;
ALTER TABLE "VisitServiceLine" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "VisitServiceLine_organizationId_idx" ON "VisitServiceLine"("organizationId");

-- DiagnosticAnalyte ← DiagnosticService
ALTER TABLE "DiagnosticAnalyte" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "DiagnosticAnalyte" AS c
SET "organizationId" = p."organizationId"
FROM "DiagnosticService" AS p
WHERE c."service_id" = p.id
  AND c."organizationId" IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "DiagnosticAnalyte" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'DiagnosticAnalyte: organizationId backfill left null rows';
  END IF;
END $$;
ALTER TABLE "DiagnosticAnalyte" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "DiagnosticAnalyte_organizationId_idx" ON "DiagnosticAnalyte"("organizationId");

-- AnalyteValueOption ← DiagnosticAnalyte
ALTER TABLE "AnalyteValueOption" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "AnalyteValueOption" AS c
SET "organizationId" = p."organizationId"
FROM "DiagnosticAnalyte" AS p
WHERE c."analyte_id" = p.id
  AND c."organizationId" IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "AnalyteValueOption" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'AnalyteValueOption: organizationId backfill left null rows';
  END IF;
END $$;
ALTER TABLE "AnalyteValueOption" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "AnalyteValueOption_organizationId_idx" ON "AnalyteValueOption"("organizationId");

-- LabOrderItem ← LabOrder
ALTER TABLE "LabOrderItem" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "LabOrderItem" AS c
SET "organizationId" = p."organizationId"
FROM "LabOrder" AS p
WHERE c."lab_order_id" = p.id
  AND c."organizationId" IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "LabOrderItem" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'LabOrderItem: organizationId backfill left null rows';
  END IF;
END $$;
ALTER TABLE "LabOrderItem" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "LabOrderItem_organizationId_idx" ON "LabOrderItem"("organizationId");

-- LabResult ← LabOrderItem
ALTER TABLE "LabResult" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "LabResult" AS c
SET "organizationId" = p."organizationId"
FROM "LabOrderItem" AS p
WHERE c."lab_order_item_id" = p.id
  AND c."organizationId" IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "LabResult" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'LabResult: organizationId backfill left null rows';
  END IF;
END $$;
ALTER TABLE "LabResult" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "LabResult_organizationId_idx" ON "LabResult"("organizationId");

-- episode_care_doctor ← ClinicalEpisode
ALTER TABLE "episode_care_doctor" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "episode_care_doctor" AS c
SET "organizationId" = p."organizationId"
FROM "ClinicalEpisode" AS p
WHERE c."episode_id" = p.id
  AND c."organizationId" IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "episode_care_doctor" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'episode_care_doctor: organizationId backfill left null rows';
  END IF;
END $$;
ALTER TABLE "episode_care_doctor" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "episode_care_doctor_organizationId_idx" ON "episode_care_doctor"("organizationId");

-- ClinicalComplaint ← ClinicalEpisode
ALTER TABLE "ClinicalComplaint" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "ClinicalComplaint" AS c
SET "organizationId" = p."organizationId"
FROM "ClinicalEpisode" AS p
WHERE c."episodeId" = p.id
  AND c."organizationId" IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ClinicalComplaint" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ClinicalComplaint: organizationId backfill left null rows';
  END IF;
END $$;
ALTER TABLE "ClinicalComplaint" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ClinicalComplaint_organizationId_idx" ON "ClinicalComplaint"("organizationId");

-- ClinicalDiagnosis ← ClinicalEpisode
ALTER TABLE "ClinicalDiagnosis" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "ClinicalDiagnosis" AS c
SET "organizationId" = p."organizationId"
FROM "ClinicalEpisode" AS p
WHERE c."episodeId" = p.id
  AND c."organizationId" IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ClinicalDiagnosis" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ClinicalDiagnosis: organizationId backfill left null rows';
  END IF;
END $$;
ALTER TABLE "ClinicalDiagnosis" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ClinicalDiagnosis_organizationId_idx" ON "ClinicalDiagnosis"("organizationId");

-- procedure_type_requirement ← ProcedureType
ALTER TABLE "procedure_type_requirement" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "procedure_type_requirement" AS c
SET "organizationId" = p."organizationId"
FROM "ProcedureType" AS p
WHERE c."procedure_type_id" = p.id
  AND c."organizationId" IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "procedure_type_requirement" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'procedure_type_requirement: organizationId backfill left null rows';
  END IF;
END $$;
ALTER TABLE "procedure_type_requirement" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "procedure_type_requirement_organizationId_idx" ON "procedure_type_requirement"("organizationId");

-- program_template_block_member ← ProgramTemplate
ALTER TABLE "program_template_block_member" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "program_template_block_member" AS c
SET "organizationId" = p."organizationId"
FROM "ProgramTemplate" AS p
WHERE c."template_id" = p.id
  AND c."organizationId" IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "program_template_block_member" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'program_template_block_member: organizationId backfill left null rows';
  END IF;
END $$;
ALTER TABLE "program_template_block_member" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "program_template_block_member_organizationId_idx" ON "program_template_block_member"("organizationId");

-- ProgramTemplateQuotaKnot ← ProgramTemplate
ALTER TABLE "ProgramTemplateQuotaKnot" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "ProgramTemplateQuotaKnot" AS c
SET "organizationId" = p."organizationId"
FROM "ProgramTemplate" AS p
WHERE c."templateId" = p.id
  AND c."organizationId" IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ProgramTemplateQuotaKnot" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ProgramTemplateQuotaKnot: organizationId backfill left null rows';
  END IF;
END $$;
ALTER TABLE "ProgramTemplateQuotaKnot" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ProgramTemplateQuotaKnot_organizationId_idx" ON "ProgramTemplateQuotaKnot"("organizationId");

-- ProgramTemplateProcedure ← ProgramTemplate
ALTER TABLE "ProgramTemplateProcedure" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "ProgramTemplateProcedure" AS c
SET "organizationId" = p."organizationId"
FROM "ProgramTemplate" AS p
WHERE c."templateId" = p.id
  AND c."organizationId" IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ProgramTemplateProcedure" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ProgramTemplateProcedure: organizationId backfill left null rows';
  END IF;
END $$;
ALTER TABLE "ProgramTemplateProcedure" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ProgramTemplateProcedure_organizationId_idx" ON "ProgramTemplateProcedure"("organizationId");

-- ProgramProcedureBalance ← ProgramInstance
ALTER TABLE "ProgramProcedureBalance" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "ProgramProcedureBalance" AS c
SET "organizationId" = p."organizationId"
FROM "ProgramInstance" AS p
WHERE c."instanceId" = p.id
  AND c."organizationId" IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ProgramProcedureBalance" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ProgramProcedureBalance: organizationId backfill left null rows';
  END IF;
END $$;
ALTER TABLE "ProgramProcedureBalance" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ProgramProcedureBalance_organizationId_idx" ON "ProgramProcedureBalance"("organizationId");

-- procedure_allocation ← ProcedureOrder
ALTER TABLE "procedure_allocation" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "procedure_allocation" AS c
SET "organizationId" = p."organizationId"
FROM "ProcedureOrder" AS p
WHERE c."procedure_order_id" = p.id
  AND c."organizationId" IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "procedure_allocation" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'procedure_allocation: organizationId backfill left null rows';
  END IF;
END $$;
ALTER TABLE "procedure_allocation" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "procedure_allocation_organizationId_idx" ON "procedure_allocation"("organizationId");

-- inpatient_daily_charges ← InpatientAdmission
ALTER TABLE "inpatient_daily_charges" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "inpatient_daily_charges" AS c
SET "organizationId" = p."organizationId"
FROM "InpatientAdmission" AS p
WHERE c."admission_id" = p.id
  AND c."organizationId" IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "inpatient_daily_charges" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'inpatient_daily_charges: organizationId backfill left null rows';
  END IF;
END $$;
ALTER TABLE "inpatient_daily_charges" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "inpatient_daily_charges_organizationId_idx" ON "inpatient_daily_charges"("organizationId");

-- ClinicReceiptLine ← ClinicReceipt
ALTER TABLE "ClinicReceiptLine" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "ClinicReceiptLine" AS c
SET "organizationId" = p."organizationId"
FROM "ClinicReceipt" AS p
WHERE c."receiptId" = p.id
  AND c."organizationId" IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ClinicReceiptLine" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ClinicReceiptLine: organizationId backfill left null rows';
  END IF;
END $$;
ALTER TABLE "ClinicReceiptLine" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ClinicReceiptLine_organizationId_idx" ON "ClinicReceiptLine"("organizationId");

-- ClinicReceiptPayment ← ClinicReceipt
ALTER TABLE "ClinicReceiptPayment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "ClinicReceiptPayment" AS c
SET "organizationId" = p."organizationId"
FROM "ClinicReceipt" AS p
WHERE c."receiptId" = p.id
  AND c."organizationId" IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ClinicReceiptPayment" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ClinicReceiptPayment: organizationId backfill left null rows';
  END IF;
END $$;
ALTER TABLE "ClinicReceiptPayment" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ClinicReceiptPayment_organizationId_idx" ON "ClinicReceiptPayment"("organizationId");
