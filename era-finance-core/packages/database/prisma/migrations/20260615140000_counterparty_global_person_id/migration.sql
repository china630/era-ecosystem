ALTER TABLE "counterparties"
  ADD COLUMN IF NOT EXISTS "global_person_id" UUID;

CREATE INDEX IF NOT EXISTS "counterparties_global_person_id_idx"
  ON "counterparties" ("global_person_id");
