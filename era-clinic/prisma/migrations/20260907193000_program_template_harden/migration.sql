-- CLI-51 harden: one current per code; backfill entitlement snapshots
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramTemplate_one_current_per_code"
  ON "ProgramTemplate"("organization_id", "code")
  WHERE "is_current" = true;

-- Freeze entitlement for existing instances that still lack a snapshot
UPDATE "ProgramInstance" pi
SET entitlement_snapshot = jsonb_build_object(
  'version', pt.version,
  'templateId', pt.id,
  'code', pt.code,
  'procedures', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'procedureCode', p."procedureCode",
      'procedureName', p."procedureName",
      'quotaTotal', p."quotaTotal",
      'kind', p.kind,
      'sortOrder', p.sort_order
    ) ORDER BY p.sort_order, p."procedureCode")
    FROM "ProgramTemplateProcedure" p
    WHERE p."templateId" = pt.id
  ), '[]'::jsonb),
  'knots', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'nights', k.nights,
      'procedureCode', k."procedureCode",
      'qty', k.qty
    ) ORDER BY k.nights, k."procedureCode")
    FROM "ProgramTemplateQuotaKnot" k
    WHERE k."templateId" = pt.id
  ), '[]'::jsonb),
  'members', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'blockCode', m.block_code,
      'procedureCode', m.procedure_code
    ) ORDER BY m.block_code, m.procedure_code)
    FROM program_template_block_member m
    WHERE m.template_id = pt.id
  ), '[]'::jsonb)
)
FROM "ProgramTemplate" pt
WHERE pi."templateId" = pt.id
  AND pi.entitlement_snapshot IS NULL;
