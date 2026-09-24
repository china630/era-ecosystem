-- Dated brigade membership intervals (ADR cp-workforce-brigade-membership)

ALTER TABLE "workforce_brigade_members"
  ADD COLUMN "effective_from" DATE,
  ADD COLUMN "effective_to" DATE,
  ADD COLUMN "left_to_brigade_id" UUID;

UPDATE "workforce_brigade_members"
SET "effective_from" = (("created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Baku')::date
WHERE "effective_from" IS NULL;

-- Duplicate employment: latest created_at stays open. Earlier rows close the day
-- before that open start. Same-day losers overlap the winner, so they are dropped
-- (last write wins; a one-day interval on the winner's start day is not history).
WITH ranked AS (
  SELECT
    id,
    employment_id,
    ROW_NUMBER() OVER (PARTITION BY employment_id ORDER BY created_at DESC, id DESC) AS rn
  FROM "workforce_brigade_members"
),
winner AS (
  SELECT m.employment_id, m.brigade_id AS winner_brigade_id, m.effective_from AS open_from
  FROM "workforce_brigade_members" m
  JOIN ranked r ON r.id = m.id
  WHERE r.rn = 1
)
UPDATE "workforce_brigade_members" m
SET
  "effective_to" = w.open_from - 1,
  "left_to_brigade_id" = w.winner_brigade_id
FROM ranked r
JOIN winner w ON w.employment_id = r.employment_id
WHERE r.id = m.id
  AND r.rn > 1
  AND m."effective_to" IS NULL
  AND m."effective_from" <= (w.open_from - 1);

WITH ranked AS (
  SELECT
    id,
    employment_id,
    ROW_NUMBER() OVER (PARTITION BY employment_id ORDER BY created_at DESC, id DESC) AS rn
  FROM "workforce_brigade_members"
)
DELETE FROM "workforce_brigade_members" m
USING ranked r
WHERE r.id = m.id
  AND r.rn > 1
  AND m."effective_to" IS NULL;

ALTER TABLE "workforce_brigade_members"
  ALTER COLUMN "effective_from" SET NOT NULL;

DROP INDEX IF EXISTS "workforce_brigade_members_brigade_id_employment_id_key";
DROP INDEX IF EXISTS "workforce_brigade_members_organization_id_employment_id_idx";

CREATE INDEX "workforce_brigade_members_organization_id_employment_id_effective_from_idx"
  ON "workforce_brigade_members"("organization_id", "employment_id", "effective_from");
CREATE INDEX "workforce_brigade_members_organization_id_brigade_id_effective_from_idx"
  ON "workforce_brigade_members"("organization_id", "brigade_id", "effective_from");

CREATE UNIQUE INDEX "workforce_brigade_members_one_open"
  ON "workforce_brigade_members"("employment_id")
  WHERE "effective_to" IS NULL;

ALTER TABLE "workforce_brigade_members"
  ADD CONSTRAINT "workforce_brigade_members_left_to_brigade_id_fkey"
  FOREIGN KEY ("left_to_brigade_id") REFERENCES "workforce_brigades"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
