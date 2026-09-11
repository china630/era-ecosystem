-- CLI-56 data: WO attending doctor (#24 doctorId → attending Visit) → episode care team

-- Link any attending Visit still missing clinical_episode_id (same rules as CLI-55)
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
  AND v."reservationId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "cutover_import_key" k
    WHERE k."record_id" = v."id" AND k."entity" = 'attending-visits'
  );

UPDATE "Visit" v
SET "clinical_episode_id" = (
  SELECT e.id FROM "ClinicalEpisode" e
  WHERE e."patientRefId" = v."patientRefId"
  ORDER BY e."openedAt" DESC
  LIMIT 1
)
WHERE v."clinical_episode_id" IS NULL
  AND EXISTS (
    SELECT 1 FROM "cutover_import_key" k
    WHERE k."record_id" = v."id" AND k."entity" = 'attending-visits'
  )
  AND EXISTS (
    SELECT 1 FROM "ClinicalEpisode" e WHERE e."patientRefId" = v."patientRefId"
  );

-- Insert care-team rows from WO attending Visits (idempotent)
INSERT INTO "episode_care_doctor" (
  "id",
  "episode_id",
  "practitioner_id",
  "assigned_at",
  "assigned_by_user_id"
)
SELECT
  gen_random_uuid()::text,
  v."clinical_episode_id",
  v."practitionerId",
  COALESCE(v."createdAt", NOW()),
  NULL
FROM "Visit" v
INNER JOIN "cutover_import_key" k
  ON k."record_id" = v."id"
 AND k."entity" = 'attending-visits'
WHERE v."clinical_episode_id" IS NOT NULL
  AND v."practitionerId" IS NOT NULL
ON CONFLICT ("episode_id", "practitioner_id") DO NOTHING;
