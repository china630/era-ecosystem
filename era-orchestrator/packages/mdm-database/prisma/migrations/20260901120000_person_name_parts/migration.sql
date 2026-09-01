-- Person name SoR: first / middle / last cipher columns.
-- full_name_cipher remains denormalized (compose of parts).

ALTER TABLE "global_natural_persons"
  ADD COLUMN IF NOT EXISTS "first_name_cipher" TEXT;

ALTER TABLE "global_natural_persons"
  ADD COLUMN IF NOT EXISTS "middle_name_cipher" TEXT;

ALTER TABLE "global_natural_persons"
  ADD COLUMN IF NOT EXISTS "last_name_cipher" TEXT;
