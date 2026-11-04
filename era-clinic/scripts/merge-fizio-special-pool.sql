-- Merge SVC_SPECIAL_POOL into SVC_FIZIO_POOL for Nafta Premium and Derma.
-- Detoks has no special pool: only the physio daily cap becomes 10.
-- Open courses only. Does not cancel sessions.
-- Dump first. Do not run until /root/era-clinic-2026-11-04.sql.gz is in place.
--
-- psql: \i scripts/merge-fizio-special-pool.sql

BEGIN;

CREATE TEMP TABLE merge_templates ON COMMIT DROP AS
SELECT DISTINCT t.id
FROM "ProgramTemplate" t
WHERE t.code IN ('PKG-PREMIUM', 'PKG-DERMA', 'PKG-DETOKS')
  AND (
    t.is_current = true
    OR t.id IN (
      SELECT i."templateId"
      FROM "ProgramInstance" i
      JOIN "ClinicalEpisode" e ON e.id = i."episodeId"
      WHERE e.status = 'OPEN'
        AND i."programCode" IN ('PKG-PREMIUM', 'PKG-DERMA', 'PKG-DETOKS')
    )
  );

DELETE FROM program_template_block_member s
USING program_template_block_member f
WHERE s.template_id = f.template_id
  AND s.template_id IN (SELECT id FROM merge_templates)
  AND s.block_code = 'SVC_SPECIAL_POOL'
  AND f.block_code = 'SVC_FIZIO_POOL'
  AND s.procedure_code = f.procedure_code;

UPDATE program_template_block_member
SET block_code = 'SVC_FIZIO_POOL'
WHERE template_id IN (SELECT id FROM merge_templates)
  AND block_code = 'SVC_SPECIAL_POOL';

UPDATE "ProgramTemplateQuotaKnot" f
SET qty = f.qty + s.qty
FROM "ProgramTemplateQuotaKnot" s
WHERE f."templateId" = s."templateId"
  AND f."templateId" IN (SELECT id FROM merge_templates)
  AND f.nights = s.nights
  AND f."procedureCode" = 'SVC_FIZIO_POOL'
  AND s."procedureCode" = 'SVC_SPECIAL_POOL';

DELETE FROM "ProgramTemplateQuotaKnot" s
WHERE s."templateId" IN (SELECT id FROM merge_templates)
  AND s."procedureCode" = 'SVC_SPECIAL_POOL';

UPDATE "ProgramTemplateProcedure" f
SET "quotaTotal" = f."quotaTotal" + s."quotaTotal",
    daily_distinct_cap = 10
FROM "ProgramTemplateProcedure" s
WHERE f."templateId" = s."templateId"
  AND f."templateId" IN (SELECT id FROM merge_templates)
  AND f."procedureCode" = 'SVC_FIZIO_POOL'
  AND s."procedureCode" = 'SVC_SPECIAL_POOL';

DELETE FROM "ProgramTemplateProcedure" s
WHERE s."templateId" IN (SELECT id FROM merge_templates)
  AND s."procedureCode" = 'SVC_SPECIAL_POOL';

UPDATE "ProgramTemplateProcedure"
SET daily_distinct_cap = 10
WHERE "templateId" IN (SELECT id FROM merge_templates)
  AND "procedureCode" = 'SVC_FIZIO_POOL';

CREATE TEMP TABLE open_courses ON COMMIT DROP AS
SELECT i.id AS instance_id, i."episodeId" AS episode_id, i."programCode" AS program_code
FROM "ProgramInstance" i
JOIN "ClinicalEpisode" e ON e.id = i."episodeId"
WHERE e.status = 'OPEN'
  AND i."programCode" IN ('PKG-PREMIUM', 'PKG-DERMA', 'PKG-DETOKS');

UPDATE "ProcedureOrder" o
SET package_quota_code = 'SVC_FIZIO_POOL'
FROM open_courses c
WHERE o.clinical_episode_id = c.episode_id
  AND o.package_quota_code = 'SVC_SPECIAL_POOL';

CREATE TEMP TABLE live_fizio ON COMMIT DROP AS
SELECT c.instance_id,
       COUNT(o.id)::int AS used
FROM open_courses c
LEFT JOIN "ProcedureOrder" o
  ON o.clinical_episode_id = c.episode_id
 AND o.package_quota_code = 'SVC_FIZIO_POOL'
 AND o.status::text <> 'CANCELLED'
GROUP BY c.instance_id;

UPDATE "ProgramProcedureBalance" f
SET "quotaTotal" = GREATEST(f."quotaTotal" + COALESCE(s."quotaTotal", 0), live.used),
    "quotaUsed" = live.used
FROM live_fizio live
LEFT JOIN "ProgramProcedureBalance" s
  ON s."instanceId" = live.instance_id
 AND s."procedureCode" = 'SVC_SPECIAL_POOL'
WHERE f."instanceId" = live.instance_id
  AND f."procedureCode" = 'SVC_FIZIO_POOL';

INSERT INTO "ProgramProcedureBalance" (id, "organizationId", "instanceId", "procedureCode", "quotaTotal", "quotaUsed")
SELECT 'merge_' || s.id,
       s."organizationId",
       s."instanceId",
       'SVC_FIZIO_POOL',
       GREATEST(s."quotaTotal", live.used),
       live.used
FROM "ProgramProcedureBalance" s
JOIN live_fizio live ON live.instance_id = s."instanceId"
WHERE s."procedureCode" = 'SVC_SPECIAL_POOL'
  AND NOT EXISTS (
    SELECT 1 FROM "ProgramProcedureBalance" f
    WHERE f."instanceId" = s."instanceId" AND f."procedureCode" = 'SVC_FIZIO_POOL'
  );

DELETE FROM "ProgramProcedureBalance" s
USING open_courses c
WHERE s."instanceId" = c.instance_id
  AND s."procedureCode" = 'SVC_SPECIAL_POOL';

UPDATE "ProgramInstance" i
SET entitlement_snapshot = (
  WITH snap AS (
    SELECT i.entitlement_snapshot AS js
  ),
  procs AS (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN elem->>'procedureCode' = 'SVC_FIZIO_POOL' THEN
          elem || jsonb_build_object(
            'quotaTotal',
            GREATEST(
              COALESCE((elem->>'quotaTotal')::int, 0)
                + COALESCE((
                    SELECT (special->>'quotaTotal')::int
                    FROM jsonb_array_elements(snap.js->'procedures') special
                    WHERE special->>'procedureCode' = 'SVC_SPECIAL_POOL'
                    LIMIT 1
                  ), 0),
              (SELECT used FROM live_fizio WHERE instance_id = i.id)
            ),
            'dailyDistinctCap', 10
          )
        ELSE elem
      END
    ), '[]'::jsonb) AS arr
    FROM snap, jsonb_array_elements(snap.js->'procedures') elem
    WHERE elem->>'procedureCode' IS DISTINCT FROM 'SVC_SPECIAL_POOL'
  ),
  mem AS (
    SELECT COALESCE(jsonb_agg(DISTINCT member), '[]'::jsonb) AS arr
    FROM snap, LATERAL (
      SELECT jsonb_build_object(
        'blockCode',
        CASE WHEN m->>'blockCode' = 'SVC_SPECIAL_POOL' THEN 'SVC_FIZIO_POOL' ELSE m->>'blockCode' END,
        'procedureCode', m->>'procedureCode'
      ) AS member
      FROM jsonb_array_elements(snap.js->'members') m
    ) rewritten
  ),
  knots AS (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN knot->>'procedureCode' = 'SVC_FIZIO_POOL' THEN
          knot || jsonb_build_object(
            'qty',
            COALESCE((knot->>'qty')::int, 0) + COALESCE((
              SELECT (other->>'qty')::int
              FROM jsonb_array_elements(snap.js->'knots') other
              WHERE other->>'procedureCode' = 'SVC_SPECIAL_POOL'
                AND other->>'nights' = knot->>'nights'
              LIMIT 1
            ), 0)
          )
        ELSE knot
      END
    ), '[]'::jsonb) AS arr
    FROM snap, jsonb_array_elements(COALESCE(snap.js->'knots', '[]'::jsonb)) knot
    WHERE knot->>'procedureCode' IS DISTINCT FROM 'SVC_SPECIAL_POOL'
  )
  SELECT CASE
    WHEN snap.js IS NULL THEN NULL
    ELSE snap.js
      || jsonb_build_object('procedures', procs.arr, 'members', mem.arr, 'knots', knots.arr)
  END
  FROM snap, procs, mem, knots
)
FROM open_courses c
WHERE i.id = c.instance_id
  AND i.entitlement_snapshot IS NOT NULL;

COMMIT;
