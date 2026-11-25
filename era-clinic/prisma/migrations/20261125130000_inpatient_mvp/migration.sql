-- MED-P0-05 inpatient MVP foundation (admission, movement, vitals, orders, MAR)

-- Admission status: REGISTERED + REFUSED; retire legacy TRANSFERRED
CREATE TYPE "InpatientAdmissionStatus_new" AS ENUM ('REGISTERED', 'ADMITTED', 'DISCHARGED', 'REFUSED');

ALTER TABLE "InpatientAdmission" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "InpatientAdmission"
  ALTER COLUMN "status" TYPE "InpatientAdmissionStatus_new"
  USING (
    CASE "status"::text
      WHEN 'TRANSFERRED' THEN 'ADMITTED'
      ELSE "status"::text
    END::"InpatientAdmissionStatus_new"
  );

DROP TYPE "InpatientAdmissionStatus";
ALTER TYPE "InpatientAdmissionStatus_new" RENAME TO "InpatientAdmissionStatus";
ALTER TABLE "InpatientAdmission" ALTER COLUMN "status" SET DEFAULT 'ADMITTED';

CREATE TYPE "InpatientAdmissionKind" AS ENUM ('PLANNED', 'EMERGENCY');
CREATE TYPE "InpatientAdmissionSource" AS ENUM ('SELF', 'REFERRAL', 'AMBULANCE', 'TRANSFER', 'ITS_REFERRAL');
CREATE TYPE "InpatientAdmissionOutcome" AS ENUM (
  'RECOVERED', 'IMPROVED', 'UNCHANGED', 'WORSENED', 'TRANSFERRED', 'DIED', 'SELF_DISCHARGE'
);

CREATE TYPE "BedStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'CLEANING', 'BLOCKED');

ALTER TABLE "Bed" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Bed"
  ALTER COLUMN "status" TYPE "BedStatus"
  USING (
    CASE
      WHEN "status" IN ('AVAILABLE', 'OCCUPIED', 'CLEANING', 'BLOCKED') THEN "status"::"BedStatus"
      ELSE 'AVAILABLE'::"BedStatus"
    END
  );
ALTER TABLE "Bed" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE'::"BedStatus";

ALTER TABLE "InpatientAdmission"
  ADD COLUMN IF NOT EXISTS "admission_kind" "InpatientAdmissionKind" NOT NULL DEFAULT 'PLANNED',
  ADD COLUMN IF NOT EXISTS "source" "InpatientAdmissionSource" NOT NULL DEFAULT 'SELF',
  ADD COLUMN IF NOT EXISTS "referral_ref" TEXT,
  ADD COLUMN IF NOT EXISTS "department_id" TEXT,
  ADD COLUMN IF NOT EXISTS "attending_practitioner_id" TEXT,
  ADD COLUMN IF NOT EXISTS "admission_note_id" TEXT,
  ADD COLUMN IF NOT EXISTS "refusal_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "outcome" "InpatientAdmissionOutcome",
  ADD COLUMN IF NOT EXISTS "case_number" TEXT,
  ADD COLUMN IF NOT EXISTS "registered_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "InpatientAdmission_organization_id_status_idx"
  ON "InpatientAdmission"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "InpatientAdmission_attending_practitioner_id_idx"
  ON "InpatientAdmission"("attending_practitioner_id");
CREATE INDEX IF NOT EXISTS "InpatientAdmission_department_id_idx"
  ON "InpatientAdmission"("department_id");
CREATE UNIQUE INDEX IF NOT EXISTS "InpatientAdmission_organization_id_case_number_key"
  ON "InpatientAdmission"("organization_id", "case_number")
  WHERE "case_number" IS NOT NULL;

ALTER TABLE "InpatientAdmission"
  ADD CONSTRAINT "InpatientAdmission_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "service_department"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InpatientAdmission"
  ADD CONSTRAINT "InpatientAdmission_attending_practitioner_id_fkey"
  FOREIGN KEY ("attending_practitioner_id") REFERENCES "Practitioner"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "inpatient_movement" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "admission_id" TEXT NOT NULL,
  "from_bed_id" TEXT,
  "to_bed_id" TEXT,
  "from_department_id" TEXT,
  "to_department_id" TEXT,
  "reason" TEXT,
  "by_user_id" TEXT,
  "moved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inpatient_movement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inpatient_movement_admission_id_moved_at_idx" ON "inpatient_movement"("admission_id", "moved_at");
CREATE INDEX "inpatient_movement_organization_id_idx" ON "inpatient_movement"("organization_id");

ALTER TABLE "inpatient_movement"
  ADD CONSTRAINT "inpatient_movement_admission_id_fkey"
  FOREIGN KEY ("admission_id") REFERENCES "InpatientAdmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inpatient_movement"
  ADD CONSTRAINT "inpatient_movement_from_bed_id_fkey"
  FOREIGN KEY ("from_bed_id") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inpatient_movement"
  ADD CONSTRAINT "inpatient_movement_to_bed_id_fkey"
  FOREIGN KEY ("to_bed_id") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inpatient_movement"
  ADD CONSTRAINT "inpatient_movement_from_department_id_fkey"
  FOREIGN KEY ("from_department_id") REFERENCES "service_department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inpatient_movement"
  ADD CONSTRAINT "inpatient_movement_to_department_id_fkey"
  FOREIGN KEY ("to_department_id") REFERENCES "service_department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "VitalSignKind" AS ENUM (
  'TEMP', 'BP_SYS', 'BP_DIA', 'PULSE', 'RESP', 'SPO2', 'WEIGHT', 'HEIGHT', 'PAIN', 'GLUCOSE'
);
CREATE TYPE "RiskAssessmentScale" AS ENUM ('MORSE', 'WATERLOW', 'NEWS2', 'VAS');
CREATE TYPE "InpatientOrderKind" AS ENUM ('MEDICATION', 'PROCEDURE', 'REGIMEN', 'DIET', 'NURSING');
CREATE TYPE "InpatientMedicationRoute" AS ENUM ('PO', 'IV', 'IM', 'SC', 'TOP', 'INH', 'SL', 'PR', 'OTHER');
CREATE TYPE "InpatientOrderStatus" AS ENUM ('ACTIVE', 'STOPPED', 'COMPLETED');
CREATE TYPE "OrderAdministrationStatus" AS ENUM ('DUE', 'GIVEN', 'MISSED', 'REFUSED', 'HELD');

CREATE TABLE "vital_sign" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "patient_ref_id" TEXT NOT NULL,
  "admission_id" TEXT,
  "visit_id" TEXT,
  "clinical_episode_id" TEXT,
  "kind" "VitalSignKind" NOT NULL,
  "value" DECIMAL(12, 3) NOT NULL,
  "unit" TEXT NOT NULL,
  "measured_at" TIMESTAMP(3) NOT NULL,
  "by_user_id" TEXT,
  CONSTRAINT "vital_sign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vital_sign_admission_id_measured_at_idx" ON "vital_sign"("admission_id", "measured_at");
CREATE INDEX "vital_sign_patient_ref_id_kind_measured_at_idx" ON "vital_sign"("patient_ref_id", "kind", "measured_at");
CREATE INDEX "vital_sign_organization_id_idx" ON "vital_sign"("organization_id");

ALTER TABLE "vital_sign"
  ADD CONSTRAINT "vital_sign_patient_ref_id_fkey"
  FOREIGN KEY ("patient_ref_id") REFERENCES "PatientRef"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vital_sign"
  ADD CONSTRAINT "vital_sign_admission_id_fkey"
  FOREIGN KEY ("admission_id") REFERENCES "InpatientAdmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vital_sign"
  ADD CONSTRAINT "vital_sign_visit_id_fkey"
  FOREIGN KEY ("visit_id") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vital_sign"
  ADD CONSTRAINT "vital_sign_clinical_episode_id_fkey"
  FOREIGN KEY ("clinical_episode_id") REFERENCES "ClinicalEpisode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "risk_assessment" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "admission_id" TEXT NOT NULL,
  "scale" "RiskAssessmentScale" NOT NULL,
  "score" INTEGER NOT NULL,
  "answers_json" TEXT NOT NULL,
  "assessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "by_user_id" TEXT,
  CONSTRAINT "risk_assessment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "risk_assessment_admission_id_assessed_at_idx" ON "risk_assessment"("admission_id", "assessed_at");
CREATE INDEX "risk_assessment_organization_id_idx" ON "risk_assessment"("organization_id");

ALTER TABLE "risk_assessment"
  ADD CONSTRAINT "risk_assessment_admission_id_fkey"
  FOREIGN KEY ("admission_id") REFERENCES "InpatientAdmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "medication_catalog" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "inn_name" TEXT NOT NULL,
  "trade_name" TEXT,
  "form" TEXT,
  "strength" TEXT,
  "unit" TEXT,
  "atc_code" TEXT,
  "finance_sku" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "medication_catalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "medication_catalog_organization_id_code_key" ON "medication_catalog"("organization_id", "code");
CREATE INDEX "medication_catalog_organization_id_active_idx" ON "medication_catalog"("organization_id", "active");

CREATE TABLE "inpatient_order" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "admission_id" TEXT NOT NULL,
  "kind" "InpatientOrderKind" NOT NULL,
  "medication_id" TEXT,
  "procedure_type_id" TEXT,
  "dose" TEXT,
  "dose_unit" TEXT,
  "route" "InpatientMedicationRoute",
  "frequency" TEXT,
  "start_at" TIMESTAMP(3) NOT NULL,
  "end_at" TIMESTAMP(3),
  "prn" BOOLEAN NOT NULL DEFAULT false,
  "status" "InpatientOrderStatus" NOT NULL DEFAULT 'ACTIVE',
  "ordered_by_practitioner_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inpatient_order_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inpatient_order_admission_id_status_idx" ON "inpatient_order"("admission_id", "status");
CREATE INDEX "inpatient_order_organization_id_idx" ON "inpatient_order"("organization_id");

ALTER TABLE "inpatient_order"
  ADD CONSTRAINT "inpatient_order_admission_id_fkey"
  FOREIGN KEY ("admission_id") REFERENCES "InpatientAdmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inpatient_order"
  ADD CONSTRAINT "inpatient_order_medication_id_fkey"
  FOREIGN KEY ("medication_id") REFERENCES "medication_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inpatient_order"
  ADD CONSTRAINT "inpatient_order_procedure_type_id_fkey"
  FOREIGN KEY ("procedure_type_id") REFERENCES "ProcedureType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inpatient_order"
  ADD CONSTRAINT "inpatient_order_ordered_by_practitioner_id_fkey"
  FOREIGN KEY ("ordered_by_practitioner_id") REFERENCES "Practitioner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "order_administration" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "scheduled_at" TIMESTAMP(3) NOT NULL,
  "status" "OrderAdministrationStatus" NOT NULL DEFAULT 'DUE',
  "given_at" TIMESTAMP(3),
  "given_by_user_id" TEXT,
  "note" TEXT,
  CONSTRAINT "order_administration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_administration_order_id_scheduled_at_key" ON "order_administration"("order_id", "scheduled_at");
CREATE INDEX "order_administration_scheduled_at_status_idx" ON "order_administration"("scheduled_at", "status");
CREATE INDEX "order_administration_organization_id_idx" ON "order_administration"("organization_id");

ALTER TABLE "order_administration"
  ADD CONSTRAINT "order_administration_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "inpatient_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;