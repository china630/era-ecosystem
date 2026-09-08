-- Program template sales window (effective_from / effective_to).
-- Product-level validity, independent from the version supersession stamp `retired_at`.
ALTER TABLE "ProgramTemplate" ADD COLUMN IF NOT EXISTS "effective_from" DATE;
ALTER TABLE "ProgramTemplate" ADD COLUMN IF NOT EXISTS "effective_to" DATE;

-- Backfill: existing current rows are sellable from today; superseded rows keep an open window
-- (they are already excluded by is_current / retired_at).
UPDATE "ProgramTemplate"
   SET "effective_from" = CURRENT_DATE
 WHERE "effective_from" IS NULL
   AND "is_current" = true;
