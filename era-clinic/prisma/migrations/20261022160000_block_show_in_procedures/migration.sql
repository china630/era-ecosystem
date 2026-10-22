-- Procedure list is a checkbox and an order on the quota block, frozen into the course snapshot.
ALTER TABLE "ProgramTemplateProcedure"
  ADD COLUMN IF NOT EXISTS "show_in_procedures" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProgramTemplateProcedure"
  ADD COLUMN IF NOT EXISTS "procedure_order" INTEGER NOT NULL DEFAULT 0;

-- One-time fill so existing treatment blocks stay on the screen. Later edits are the checkbox.
UPDATE "ProgramTemplateProcedure"
SET "show_in_procedures" = ("fulfillment" = 'PROCEDURE_ORDER'),
    "procedure_order" = "sort_order";

-- Stamp the same flags onto open-course snapshots and drop the nine removed pool blocks.
DO $$
DECLARE
  rec record;
  procs jsonb;
  members jsonb;
  knots jsonb;
  dropped text[] := ARRAY[
    'LAB_CBC_POOL',
    'LAB_BIOCHEM_POOL',
    'LAB_URINE_POOL',
    'USG_POOL',
    'CARDIO_ECG_POOL',
    'VISIT_GYN_URO_POOL',
    'VISIT_NEURO_POOL',
    'VISIT_CARDIO_POOL',
    'VISIT_GP_POOL'
  ];
BEGIN
  FOR rec IN
    SELECT id, entitlement_snapshot
    FROM "ProgramInstance"
    WHERE entitlement_snapshot IS NOT NULL
  LOOP
    SELECT COALESCE(jsonb_agg(
      proc || jsonb_build_object(
        'showInProcedures', COALESCE(proc->>'fulfillment', 'PROCEDURE_ORDER') = 'PROCEDURE_ORDER',
        'procedureOrder', COALESCE(NULLIF(proc->>'sortOrder', '')::int, 0)
      )
      ORDER BY COALESCE(NULLIF(proc->>'sortOrder', '')::int, 0)
    ), '[]'::jsonb)
    INTO procs
    FROM jsonb_array_elements(COALESCE(rec.entitlement_snapshot->'procedures', '[]'::jsonb)) proc
    WHERE NOT (proc->>'procedureCode' = ANY (dropped));

    SELECT COALESCE(jsonb_agg(m), '[]'::jsonb)
    INTO members
    FROM jsonb_array_elements(COALESCE(rec.entitlement_snapshot->'members', '[]'::jsonb)) m
    WHERE NOT (m->>'blockCode' = ANY (dropped));

    SELECT COALESCE(jsonb_agg(k), '[]'::jsonb)
    INTO knots
    FROM jsonb_array_elements(COALESCE(rec.entitlement_snapshot->'knots', '[]'::jsonb)) k
    WHERE NOT (k->>'procedureCode' = ANY (dropped));

    UPDATE "ProgramInstance"
    SET entitlement_snapshot = jsonb_set(
      jsonb_set(
        jsonb_set(rec.entitlement_snapshot, '{procedures}', procs),
        '{members}',
        members
      ),
      '{knots}',
      knots
    )
    WHERE id = rec.id;
  END LOOP;
END $$;

DELETE FROM "ProgramProcedureBalance" AS b
WHERE b."procedureCode" = ANY (ARRAY[
  'LAB_CBC_POOL',
  'LAB_BIOCHEM_POOL',
  'LAB_URINE_POOL',
  'USG_POOL',
  'CARDIO_ECG_POOL',
  'VISIT_GYN_URO_POOL',
  'VISIT_NEURO_POOL',
  'VISIT_CARDIO_POOL',
  'VISIT_GP_POOL'
])
AND b."quotaUsed" = 0
AND NOT EXISTS (
  SELECT 1
  FROM "ProcedureOrder" AS o
  JOIN "ProgramInstance" AS i ON i.id = b."instanceId"
  WHERE o."package_quota_code" = b."procedureCode"
    AND o."clinical_episode_id" = i."episodeId"
)
AND NOT EXISTS (
  SELECT 1
  FROM "LabOrderItem" AS li
  JOIN "LabOrder" AS lo ON lo.id = li.lab_order_id
  JOIN "ProgramInstance" AS i ON i.id = b."instanceId"
  WHERE li.package_quota_code = b."procedureCode"
    AND lo."clinicalEpisodeId" = i."episodeId"
)
AND NOT EXISTS (
  SELECT 1
  FROM "VisitServiceLine" AS vs
  JOIN "Visit" AS v ON v.id = vs."visitId"
  JOIN "ProgramInstance" AS i ON i.id = b."instanceId"
  WHERE vs.package_quota_code = b."procedureCode"
    AND v.clinical_episode_id = i."episodeId"
);
