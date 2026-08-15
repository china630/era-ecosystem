-- Align BedAssignment physical columns with Prisma @map (snake_case). Data-preserving renames.

ALTER TABLE "BedAssignment" RENAME COLUMN "patientRefId" TO "patient_ref_id";
ALTER TABLE "BedAssignment" RENAME COLUMN "admittedAt" TO "admitted_at";
ALTER TABLE "BedAssignment" RENAME COLUMN "dischargedAt" TO "discharged_at";

DROP INDEX IF EXISTS "BedAssignment_bedId_dischargedAt_idx";
CREATE INDEX IF NOT EXISTS "BedAssignment_bedId_discharged_at_idx"
  ON "BedAssignment"("bedId", "discharged_at");

ALTER TABLE "BedAssignment" DROP CONSTRAINT IF EXISTS "BedAssignment_patient_ref_id_fkey";
ALTER TABLE "BedAssignment"
  ADD CONSTRAINT "BedAssignment_patient_ref_id_fkey"
  FOREIGN KEY ("patient_ref_id") REFERENCES "PatientRef"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BedAssignment" DROP CONSTRAINT IF EXISTS "BedAssignment_admission_id_fkey";
ALTER TABLE "BedAssignment"
  ADD CONSTRAINT "BedAssignment_admission_id_fkey"
  FOREIGN KEY ("admission_id") REFERENCES "InpatientAdmission"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;