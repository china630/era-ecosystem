-- P1/P4: tenant presets, practitioner MDM, ward charge code, inpatient admission ADT

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "enabled_presets" TEXT[] DEFAULT ARRAY['outpatient']::TEXT[];
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "default_outlet_id" TEXT;

ALTER TABLE "Practitioner" ADD COLUMN IF NOT EXISTS "global_person_id" TEXT;
ALTER TABLE "Practitioner" ADD COLUMN IF NOT EXISTS "default_slot_minutes" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "Ward" ADD COLUMN IF NOT EXISTS "daily_charge_code" TEXT;

DO $$ BEGIN
  CREATE TYPE "InpatientAdmissionStatus" AS ENUM ('ADMITTED', 'DISCHARGED', 'TRANSFERRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "InpatientAdmission" (
  "id" TEXT NOT NULL,
  "patient_ref_id" TEXT NOT NULL,
  "status" "InpatientAdmissionStatus" NOT NULL DEFAULT 'ADMITTED',
  "admitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "discharged_at" TIMESTAMP(3),
  CONSTRAINT "InpatientAdmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InpatientAdmission_patient_ref_id_status_idx" ON "InpatientAdmission"("patient_ref_id", "status");

ALTER TABLE "InpatientAdmission" ADD CONSTRAINT "InpatientAdmission_patient_ref_id_fkey"
  FOREIGN KEY ("patient_ref_id") REFERENCES "PatientRef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BedAssignment" ADD COLUMN IF NOT EXISTS "admission_id" TEXT;
CREATE INDEX IF NOT EXISTS "BedAssignment_admission_id_idx" ON "BedAssignment"("admission_id");

ALTER TABLE "BedAssignment" ADD CONSTRAINT "BedAssignment_patient_ref_id_fkey"
  FOREIGN KEY ("patient_ref_id") REFERENCES "PatientRef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BedAssignment" ADD CONSTRAINT "BedAssignment_admission_id_fkey"
  FOREIGN KEY ("admission_id") REFERENCES "InpatientAdmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
