ALTER TABLE "ProgramTemplateProcedure" ADD COLUMN IF NOT EXISTS "fulfillment_explicit" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ProcedureType" ADD COLUMN IF NOT EXISTS "block_category" TEXT;
ALTER TABLE "ProcedureType" ADD COLUMN IF NOT EXISTS "usage_contour" TEXT NOT NULL DEFAULT 'GUEST';

ALTER TABLE "DiagnosticService" ADD COLUMN IF NOT EXISTS "usage_contour" TEXT NOT NULL DEFAULT 'GUEST';
ALTER TABLE "DiagnosticService" ADD COLUMN IF NOT EXISTS "menu_surface" TEXT;
ALTER TABLE "DiagnosticService" ADD COLUMN IF NOT EXISTS "scheduling_mode" TEXT NOT NULL DEFAULT 'FIXED';
ALTER TABLE "DiagnosticService" ADD COLUMN IF NOT EXISTS "brought_in_max_days" INTEGER;

CREATE TABLE IF NOT EXISTS "episode_brought_in_result" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "episode_id" TEXT NOT NULL,
  "service_code" TEXT NOT NULL,
  "result_on" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "episode_brought_in_result_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "episode_brought_in_result_episode_id_service_code_key"
  ON "episode_brought_in_result"("episode_id", "service_code");
CREATE INDEX IF NOT EXISTS "episode_brought_in_result_organizationId_idx"
  ON "episode_brought_in_result"("organizationId");
ALTER TABLE "episode_brought_in_result"
  DROP CONSTRAINT IF EXISTS "episode_brought_in_result_episode_id_fkey";
ALTER TABLE "episode_brought_in_result"
  ADD CONSTRAINT "episode_brought_in_result_episode_id_fkey"
  FOREIGN KEY ("episode_id") REFERENCES "ClinicalEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "DiagnosticService"
SET "brought_in_max_days" = 30
WHERE "code" = 'LAB-INFECT' AND "brought_in_max_days" IS NULL;

UPDATE "ProcedureType"
SET "block_category" = 'PARAFFIN'
WHERE "block_category" IS NULL
  AND (
    "code" ILIKE '%parafin%' OR "code" ILIKE '%paraffin%'
    OR "name" ILIKE '%parafin%' OR "name" ILIKE '%paraffin%'
  );

UPDATE "ProcedureType"
SET "block_category" = 'BATH'
WHERE "block_category" IS NULL
  AND (
    "code" ILIKE '%naftalan%' OR "name" ILIKE '%naftalan%'
    OR "name" ILIKE '%vann%' OR "name" ~* '\mbath\M'
  );

UPDATE "ProcedureType"
SET "block_category" = 'PHYSIO'
WHERE "block_category" IS NULL;

UPDATE "DiagnosticService" ds
SET "menu_surface" = CASE
  WHEN m."kind" IN ('imaging', 'functional', 'endoscopy') THEN 'DIAGNOSTIC'
  WHEN m."kind" = 'visit' THEN 'VISIT'
  ELSE 'LAB'
END
FROM "Modality" m
WHERE ds."modality_id" = m."id" AND ds."menu_surface" IS NULL;
