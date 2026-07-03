-- Wave 4: Guest identity columns removed — MDM globalPersonId is SoR for FIN/passport.
ALTER TABLE "Guest" DROP COLUMN IF EXISTS "nationalIdFin";
ALTER TABLE "Guest" DROP COLUMN IF EXISTS "passportNumber";

CREATE INDEX IF NOT EXISTS "Guest_globalPersonId_idx" ON "Guest"("globalPersonId");
