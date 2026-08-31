-- CLI-55: episode as care course — anamnesis on episode, FK children, backfill

-- ClinicalEpisode anamnesis
ALTER TABLE "ClinicalEpisode" ADD COLUMN IF NOT EXISTS "anamnesis_text" TEXT;
ALTER TABLE "ClinicalEpisode" ADD COLUMN IF NOT EXISTS "anamnesis_updated_at" TIMESTAMP(3);

-- Visit.clinicalEpisodeId
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "clinical_episode_id" TEXT;
CREATE INDEX IF NOT EXISTS "Visit_clinical_episode_id_idx" ON "Visit"("clinical_episode_id");
DO $$ BEGIN
  ALTER TABLE "Visit" ADD CONSTRAINT "Visit_clinical_episode_id_fkey"
    FOREIGN KEY ("clinical_episode_id") REFERENCES "ClinicalEpisode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProcedureOrder.clinicalEpisodeId
ALTER TABLE "ProcedureOrder" ADD COLUMN IF NOT EXISTS "clinical_episode_id" TEXT;
CREATE INDEX IF NOT EXISTS "ProcedureOrder_clinical_episode_id_idx" ON "ProcedureOrder"("clinical_episode_id");
DO $$ BEGIN
  ALTER TABLE "ProcedureOrder" ADD CONSTRAINT "ProcedureOrder_clinical_episode_id_fkey"
    FOREIGN KEY ("clinical_episode_id") REFERENCES "ClinicalEpisode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PatientContraindication.episodeId
ALTER TABLE "PatientContraindication" ADD COLUMN IF NOT EXISTS "episode_id" TEXT;
CREATE INDEX IF NOT EXISTS "PatientContraindication_episode_id_idx" ON "PatientContraindication"("episode_id");
DO $$ BEGIN
  ALTER TABLE "PatientContraindication" ADD CONSTRAINT "PatientContraindication_episode_id_fkey"
    FOREIGN KEY ("episode_id") REFERENCES "ClinicalEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill: copy PatientRef anamnesis onto latest episode when empty
UPDATE "ClinicalEpisode" e
SET "anamnesis_text" = p."anamnesis_text",
    "anamnesis_updated_at" = COALESCE(p."anamnesis_updated_at", NOW())
FROM "PatientRef" p
WHERE e."patientRefId" = p.id
  AND p."anamnesis_text" IS NOT NULL
  AND TRIM(p."anamnesis_text") <> ''
  AND (e."anamnesis_text" IS NULL OR TRIM(e."anamnesis_text") = '')
  AND e.id = (
    SELECT e2.id FROM "ClinicalEpisode" e2
    WHERE e2."patientRefId" = p.id
    ORDER BY e2."openedAt" DESC
    LIMIT 1
  );

-- Backfill contraindications -> latest episode
UPDATE "PatientContraindication" c
SET "episode_id" = (
  SELECT e.id FROM "ClinicalEpisode" e
  WHERE e."patientRefId" = c."patientRefId"
  ORDER BY e."openedAt" DESC
  LIMIT 1
)
WHERE c."episode_id" IS NULL
  AND EXISTS (SELECT 1 FROM "ClinicalEpisode" e WHERE e."patientRefId" = c."patientRefId");

-- Backfill visits: reservation match then latest episode
UPDATE "Visit" v
SET "clinical_episode_id" = (
  SELECT e.id FROM "ClinicalEpisode" e
  WHERE e."patientRefId" = v."patientRefId"
    AND v."reservationId" IS NOT NULL
    AND e."reservationId" = v."reservationId"
  ORDER BY e."openedAt" DESC
  LIMIT 1
)
WHERE v."clinical_episode_id" IS NULL
  AND v."reservationId" IS NOT NULL;

UPDATE "Visit" v
SET "clinical_episode_id" = (
  SELECT e.id FROM "ClinicalEpisode" e
  WHERE e."patientRefId" = v."patientRefId"
  ORDER BY e."openedAt" DESC
  LIMIT 1
)
WHERE v."clinical_episode_id" IS NULL
  AND EXISTS (SELECT 1 FROM "ClinicalEpisode" e WHERE e."patientRefId" = v."patientRefId");

-- Backfill procedure orders
UPDATE "ProcedureOrder" o
SET "clinical_episode_id" = (
  SELECT e.id FROM "ClinicalEpisode" e
  WHERE e."patientRefId" = o."patientRefId"
    AND o."reservationId" IS NOT NULL
    AND e."reservationId" = o."reservationId"
  ORDER BY e."openedAt" DESC
  LIMIT 1
)
WHERE o."clinical_episode_id" IS NULL
  AND o."reservationId" IS NOT NULL;

UPDATE "ProcedureOrder" o
SET "clinical_episode_id" = (
  SELECT e.id FROM "ClinicalEpisode" e
  WHERE e."patientRefId" = o."patientRefId"
  ORDER BY e."openedAt" DESC
  LIMIT 1
)
WHERE o."clinical_episode_id" IS NULL
  AND EXISTS (SELECT 1 FROM "ClinicalEpisode" e WHERE e."patientRefId" = o."patientRefId");

-- Backfill lab orders missing clinicalEpisodeId
UPDATE "LabOrder" l
SET "clinicalEpisodeId" = (
  SELECT e.id FROM "ClinicalEpisode" e
  WHERE e."patientRefId" = l."patientRefId"
  ORDER BY e."openedAt" DESC
  LIMIT 1
)
WHERE l."clinicalEpisodeId" IS NULL
  AND EXISTS (SELECT 1 FROM "ClinicalEpisode" e WHERE e."patientRefId" = l."patientRefId");
