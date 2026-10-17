-- One-time: fold package twin SVC-SOLYUKS into SVC-SOLLYUKS, then drop the twin.
-- Run inside era_clinic. Safe to re-run when the twin is gone.
-- Refuses template rewrite and twin delete when SVC-SOLLYUKS is missing
-- (otherwise orders keep the twin code with a null type).

BEGIN;

DO $$
DECLARE
  keep_id text;
  drop_id text;
  org text;
BEGIN
  FOR org, keep_id, drop_id IN
    SELECT k."organizationId", k.id, d.id
    FROM "ProcedureType" k
    JOIN "ProcedureType" d
      ON d."organizationId" = k."organizationId"
     AND d.code = 'SVC-SOLYUKS'
    WHERE k.code = 'SVC-SOLLYUKS'
  LOOP
    UPDATE "ProcedureOrder"
    SET "procedureTypeId" = keep_id,
        "procedureCode" = 'SVC-SOLLYUKS'
    WHERE "procedureTypeId" = drop_id
       OR "procedureCode" = 'SVC-SOLYUKS';

    UPDATE "ProcedureOrder"
    SET package_quota_code = 'SVC-SOLLYUKS'
    WHERE package_quota_code = 'SVC-SOLYUKS';

    INSERT INTO practitioner_skill (id, "organizationId", "practitionerId", "procedureTypeId", active)
    SELECT gen_random_uuid()::text, s."organizationId", s."practitionerId", keep_id, s.active
    FROM practitioner_skill s
    WHERE s."procedureTypeId" = drop_id
      AND NOT EXISTS (
        SELECT 1 FROM practitioner_skill x
        WHERE x."practitionerId" = s."practitionerId" AND x."procedureTypeId" = keep_id
      );
    DELETE FROM practitioner_skill WHERE "procedureTypeId" = drop_id;

    INSERT INTO staff_duty_line (
      id, "organizationId", roster_id, procedure_type_id, practitioner_id, stable, sort_order, note, created_at
    )
    SELECT gen_random_uuid()::text, l."organizationId", l.roster_id, keep_id, l.practitioner_id,
           l.stable, l.sort_order, l.note, l.created_at
    FROM staff_duty_line l
    WHERE l.procedure_type_id = drop_id
      AND NOT EXISTS (
        SELECT 1 FROM staff_duty_line x
        WHERE x.roster_id = l.roster_id
          AND x.procedure_type_id = keep_id
          AND x.practitioner_id IS NOT DISTINCT FROM l.practitioner_id
      );
    DELETE FROM staff_duty_line WHERE procedure_type_id = drop_id;

    UPDATE staff_duty_day_override o
    SET procedure_type_id = keep_id
    WHERE o.procedure_type_id = drop_id
      AND NOT EXISTS (
        SELECT 1 FROM staff_duty_day_override x
        WHERE x.roster_id = o.roster_id
          AND x.duty_date = o.duty_date
          AND x.procedure_type_id = keep_id
      );
    DELETE FROM staff_duty_day_override WHERE procedure_type_id = drop_id;

    DELETE FROM "ProcedureType" WHERE id = drop_id;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM "ProcedureType" WHERE code = 'SVC-SOLLYUKS') THEN
    RAISE NOTICE 'remap-solyuks: SVC-SOLLYUKS type missing — refuse rewrite and twin delete';
    RETURN;
  END IF;

  UPDATE program_template_block_member SET procedure_code = 'SVC-SOLLYUKS' WHERE procedure_code = 'SVC-SOLYUKS'
    AND NOT EXISTS (
      SELECT 1 FROM program_template_block_member x
      WHERE x.template_id = program_template_block_member.template_id
        AND x.block_code = program_template_block_member.block_code
        AND x.procedure_code = 'SVC-SOLLYUKS'
    );
  DELETE FROM program_template_block_member WHERE procedure_code = 'SVC-SOLYUKS';

  UPDATE "ProgramTemplateQuotaKnot" SET "procedureCode" = 'SVC-SOLLYUKS' WHERE "procedureCode" = 'SVC-SOLYUKS'
    AND NOT EXISTS (
      SELECT 1 FROM "ProgramTemplateQuotaKnot" x
      WHERE x."templateId" = "ProgramTemplateQuotaKnot"."templateId"
        AND x.nights = "ProgramTemplateQuotaKnot".nights
        AND x."procedureCode" = 'SVC-SOLLYUKS'
    );
  DELETE FROM "ProgramTemplateQuotaKnot" WHERE "procedureCode" = 'SVC-SOLYUKS';

  UPDATE "ProgramTemplateProcedure" SET "procedureCode" = 'SVC-SOLLYUKS' WHERE "procedureCode" = 'SVC-SOLYUKS'
    AND NOT EXISTS (
      SELECT 1 FROM "ProgramTemplateProcedure" x
      WHERE x."templateId" = "ProgramTemplateProcedure"."templateId"
        AND x."procedureCode" = 'SVC-SOLLYUKS'
    );
  DELETE FROM "ProgramTemplateProcedure" WHERE "procedureCode" = 'SVC-SOLYUKS';

  UPDATE "ProgramProcedureBalance" b
  SET "quotaTotal" = b."quotaTotal" + d."quotaTotal",
      "quotaUsed" = b."quotaUsed" + d."quotaUsed"
  FROM "ProgramProcedureBalance" d
  WHERE d."instanceId" = b."instanceId"
    AND b."procedureCode" = 'SVC-SOLLYUKS'
    AND d."procedureCode" = 'SVC-SOLYUKS';
  DELETE FROM "ProgramProcedureBalance" d
  WHERE d."procedureCode" = 'SVC-SOLYUKS'
    AND EXISTS (
      SELECT 1 FROM "ProgramProcedureBalance" b
      WHERE b."instanceId" = d."instanceId" AND b."procedureCode" = 'SVC-SOLLYUKS'
    );
  UPDATE "ProgramProcedureBalance" SET "procedureCode" = 'SVC-SOLLYUKS' WHERE "procedureCode" = 'SVC-SOLYUKS';

  UPDATE procedure_day_series_member SET procedure_code = 'SVC-SOLLYUKS' WHERE procedure_code = 'SVC-SOLYUKS'
    AND NOT EXISTS (
      SELECT 1 FROM procedure_day_series_member x
      WHERE x.series_id = procedure_day_series_member.series_id
        AND x.procedure_code = 'SVC-SOLLYUKS'
    );
  DELETE FROM procedure_day_series_member WHERE procedure_code = 'SVC-SOLYUKS';

  UPDATE "ProgramInstance"
  SET entitlement_snapshot = replace(entitlement_snapshot::text, 'SVC-SOLYUKS', 'SVC-SOLLYUKS')::jsonb
  WHERE entitlement_snapshot::text LIKE '%SVC-SOLYUKS%';

  DELETE FROM "ServiceCatalogCache" sc
  WHERE sc.code = 'SVC-SOLYUKS'
    AND EXISTS (
      SELECT 1 FROM "ProcedureType" k
      WHERE k."organizationId" = sc."organizationId" AND k.code = 'SVC-SOLLYUKS'
    );
  DELETE FROM "ProcedureType" d
  WHERE d.code = 'SVC-SOLYUKS'
    AND EXISTS (
      SELECT 1 FROM "ProcedureType" k
      WHERE k."organizationId" = d."organizationId" AND k.code = 'SVC-SOLLYUKS'
    )
    AND NOT EXISTS (
      SELECT 1 FROM "ProcedureOrder" o
      WHERE o."procedureTypeId" = d.id OR o."procedureCode" = 'SVC-SOLYUKS'
    );
END $$;

COMMIT;
