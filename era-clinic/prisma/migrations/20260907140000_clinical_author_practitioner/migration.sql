-- CLI-55/56: attribute anamnesis / complaints / diagnoses to authoring practitioner
ALTER TABLE "ClinicalEpisode"
  ADD COLUMN IF NOT EXISTS "anamnesis_by_practitioner_id" TEXT;

ALTER TABLE "ClinicalComplaint"
  ADD COLUMN IF NOT EXISTS "recorded_by_practitioner_id" TEXT;

ALTER TABLE "ClinicalDiagnosis"
  ADD COLUMN IF NOT EXISTS "recorded_by_practitioner_id" TEXT;

CREATE INDEX IF NOT EXISTS "ClinicalEpisode_anamnesis_by_practitioner_id_idx"
  ON "ClinicalEpisode"("anamnesis_by_practitioner_id");

CREATE INDEX IF NOT EXISTS "ClinicalComplaint_recorded_by_practitioner_id_idx"
  ON "ClinicalComplaint"("recorded_by_practitioner_id");

CREATE INDEX IF NOT EXISTS "ClinicalDiagnosis_recorded_by_practitioner_id_idx"
  ON "ClinicalDiagnosis"("recorded_by_practitioner_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClinicalEpisode_anamnesis_by_practitioner_id_fkey'
  ) THEN
    ALTER TABLE "ClinicalEpisode"
      ADD CONSTRAINT "ClinicalEpisode_anamnesis_by_practitioner_id_fkey"
      FOREIGN KEY ("anamnesis_by_practitioner_id") REFERENCES "Practitioner"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClinicalComplaint_recorded_by_practitioner_id_fkey'
  ) THEN
    ALTER TABLE "ClinicalComplaint"
      ADD CONSTRAINT "ClinicalComplaint_recorded_by_practitioner_id_fkey"
      FOREIGN KEY ("recorded_by_practitioner_id") REFERENCES "Practitioner"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClinicalDiagnosis_recorded_by_practitioner_id_fkey'
  ) THEN
    ALTER TABLE "ClinicalDiagnosis"
      ADD CONSTRAINT "ClinicalDiagnosis_recorded_by_practitioner_id_fkey"
      FOREIGN KEY ("recorded_by_practitioner_id") REFERENCES "Practitioner"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
