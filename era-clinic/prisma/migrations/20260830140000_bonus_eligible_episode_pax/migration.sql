-- Wave D: doctor bonus eligibility on completed extras
ALTER TABLE "ProcedureOrder" ADD COLUMN IF NOT EXISTS "bonus_eligible" BOOLEAN NOT NULL DEFAULT false;

-- Wave E: one OPEN episode per reservation + patient
CREATE UNIQUE INDEX IF NOT EXISTS "ClinicalEpisode_reservation_patient_open_uidx"
  ON "ClinicalEpisode" ("organizationId", "reservationId", "patientRefId")
  WHERE "status" = 'OPEN' AND "reservationId" IS NOT NULL AND "patientRefId" IS NOT NULL;
