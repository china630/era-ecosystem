-- MED-P1-03 / P1-04 / P1-05 insurance, prescriptions, patient forms

CREATE TYPE "ClinicPayerKind" AS ENUM ('ITS', 'DMS', 'CORPORATE', 'PATIENT');
CREATE TYPE "InsuranceReferralSource" AS ENUM ('E_TABIB', 'INSURER', 'MANUAL');
CREATE TYPE "InsuranceReferralStatus" AS ENUM ('NEW', 'USED', 'EXPIRED', 'REJECTED');
CREATE TYPE "PrescriptionStatus" AS ENUM ('ISSUED', 'SENT_TO_PHARMACY', 'DISPENSED', 'CANCELLED');
CREATE TYPE "PatientFormSignatureKind" AS ENUM ('SIMPLE', 'OTP', 'ASAN_IMZA');

ALTER TABLE "Visit"
  ADD COLUMN "payer_kind" "ClinicPayerKind",
  ADD COLUMN "referral_id" TEXT;

CREATE TABLE "patient_insurance_policy" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "patient_ref_id" TEXT NOT NULL,
  "payer_kind" "ClinicPayerKind" NOT NULL,
  "payer_counterparty_id" TEXT,
  "policy_number" TEXT NOT NULL,
  "valid_from" TIMESTAMP(3),
  "valid_to" TIMESTAMP(3),
  "program_code" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patient_insurance_policy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "insurance_referral" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "policy_id" TEXT,
  "patient_ref_id" TEXT NOT NULL,
  "source" "InsuranceReferralSource" NOT NULL,
  "referral_code" TEXT NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL,
  "expires_at" TIMESTAMP(3),
  "allowed_service_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status" "InsuranceReferralStatus" NOT NULL DEFAULT 'NEW',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "insurance_referral_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prescription" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "visit_id" TEXT NOT NULL,
  "patient_ref_id" TEXT NOT NULL,
  "status" "PrescriptionStatus" NOT NULL DEFAULT 'ISSUED',
  "prescription_queue_id" TEXT,
  "issued_by_user_id" TEXT,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prescription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prescription_line" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "prescription_id" TEXT NOT NULL,
  "medication_id" TEXT,
  "sku" TEXT,
  "qty" DECIMAL(12,3) NOT NULL,
  "dose" TEXT,
  "route" TEXT,
  "frequency" TEXT,
  "duration_days" INTEGER,
  "instructions" TEXT,
  "rx_required" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "prescription_line_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "patient_form_template" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title_en" TEXT NOT NULL,
  "title_ru" TEXT NOT NULL,
  "title_az" TEXT NOT NULL,
  "sections_json" TEXT NOT NULL,
  "consent_required" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patient_form_template_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "patient_form_response" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "template_code" TEXT NOT NULL,
  "patient_ref_id" TEXT NOT NULL,
  "appointment_id" TEXT,
  "answers_json" TEXT NOT NULL,
  "signed_at" TIMESTAMP(3),
  "signature_kind" "PatientFormSignatureKind" NOT NULL DEFAULT 'SIMPLE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patient_form_response_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "patient_insurance_policy"
  ADD CONSTRAINT "patient_insurance_policy_patient_ref_id_fkey"
  FOREIGN KEY ("patient_ref_id") REFERENCES "PatientRef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "insurance_referral"
  ADD CONSTRAINT "insurance_referral_policy_id_fkey"
  FOREIGN KEY ("policy_id") REFERENCES "patient_insurance_policy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Visit"
  ADD CONSTRAINT "Visit_referral_id_fkey"
  FOREIGN KEY ("referral_id") REFERENCES "insurance_referral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "prescription"
  ADD CONSTRAINT "prescription_visit_id_fkey"
  FOREIGN KEY ("visit_id") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "prescription_patient_ref_id_fkey"
  FOREIGN KEY ("patient_ref_id") REFERENCES "PatientRef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "prescription_line"
  ADD CONSTRAINT "prescription_line_prescription_id_fkey"
  FOREIGN KEY ("prescription_id") REFERENCES "prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "prescription_line_medication_id_fkey"
  FOREIGN KEY ("medication_id") REFERENCES "medication_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "patient_form_response"
  ADD CONSTRAINT "patient_form_response_patient_ref_id_fkey"
  FOREIGN KEY ("patient_ref_id") REFERENCES "PatientRef"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "patient_form_response_appointment_id_fkey"
  FOREIGN KEY ("appointment_id") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "patient_insurance_policy_patient_ref_id_active_idx" ON "patient_insurance_policy"("patient_ref_id", "active");
CREATE INDEX "patient_insurance_policy_organization_id_idx" ON "patient_insurance_policy"("organization_id");
CREATE INDEX "insurance_referral_patient_ref_id_status_idx" ON "insurance_referral"("patient_ref_id", "status");
CREATE INDEX "insurance_referral_organization_id_referral_code_idx" ON "insurance_referral"("organization_id", "referral_code");
CREATE INDEX "prescription_visit_id_idx" ON "prescription"("visit_id");
CREATE INDEX "prescription_patient_ref_id_issued_at_idx" ON "prescription"("patient_ref_id", "issued_at");
CREATE INDEX "prescription_organization_id_idx" ON "prescription"("organization_id");
CREATE INDEX "prescription_line_prescription_id_idx" ON "prescription_line"("prescription_id");
CREATE INDEX "prescription_line_organization_id_idx" ON "prescription_line"("organization_id");
CREATE UNIQUE INDEX "patient_form_template_organization_id_code_key" ON "patient_form_template"("organization_id", "code");
CREATE INDEX "patient_form_template_organization_id_active_idx" ON "patient_form_template"("organization_id", "active");
CREATE INDEX "patient_form_response_patient_ref_id_template_code_idx" ON "patient_form_response"("patient_ref_id", "template_code");
CREATE INDEX "patient_form_response_appointment_id_idx" ON "patient_form_response"("appointment_id");
CREATE INDEX "patient_form_response_organization_id_idx" ON "patient_form_response"("organization_id");