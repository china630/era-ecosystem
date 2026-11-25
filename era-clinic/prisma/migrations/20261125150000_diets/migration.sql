-- MED-P1-06/P1-07/P1-09 foundations

CREATE TYPE "AmbulatoryCarePlanStatus" AS ENUM ('DRAFT', 'PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "ambulatory_care_plans" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "patient_ref_id" TEXT NOT NULL,
    "title" TEXT,
    "stages_json" JSONB NOT NULL,
    "status" "AmbulatoryCarePlanStatus" NOT NULL DEFAULT 'DRAFT',
    "proposed_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ambulatory_care_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ambulatory_care_plans_visit_id_key" ON "ambulatory_care_plans"("visit_id");
CREATE INDEX "ambulatory_care_plans_patient_ref_id_idx" ON "ambulatory_care_plans"("patient_ref_id");
CREATE INDEX "ambulatory_care_plans_organizationId_idx" ON "ambulatory_care_plans"("organizationId");

ALTER TABLE "ambulatory_care_plans" ADD CONSTRAINT "ambulatory_care_plans_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ambulatory_care_plans" ADD CONSTRAINT "ambulatory_care_plans_patient_ref_id_fkey" FOREIGN KEY ("patient_ref_id") REFERENCES "PatientRef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "diet_tables" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title_az" TEXT NOT NULL,
    "title_ru" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diet_tables_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "diet_tables_organizationId_code_key" ON "diet_tables"("organizationId", "code");
CREATE INDEX "diet_tables_organizationId_is_active_idx" ON "diet_tables"("organizationId", "is_active");

CREATE TABLE "diet_assignments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "diet_table_id" TEXT NOT NULL,
    "clinical_episode_id" TEXT,
    "admission_id" TEXT,
    "assigned_from" DATE NOT NULL,
    "assigned_to" DATE,
    "assigned_by_practitioner_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diet_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "diet_assignments_diet_table_id_assigned_from_idx" ON "diet_assignments"("diet_table_id", "assigned_from");
CREATE INDEX "diet_assignments_clinical_episode_id_idx" ON "diet_assignments"("clinical_episode_id");
CREATE INDEX "diet_assignments_admission_id_idx" ON "diet_assignments"("admission_id");
CREATE INDEX "diet_assignments_organizationId_idx" ON "diet_assignments"("organizationId");

ALTER TABLE "diet_assignments" ADD CONSTRAINT "diet_assignments_diet_table_id_fkey" FOREIGN KEY ("diet_table_id") REFERENCES "diet_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "diet_assignments" ADD CONSTRAINT "diet_assignments_clinical_episode_id_fkey" FOREIGN KEY ("clinical_episode_id") REFERENCES "ClinicalEpisode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "diet_assignments" ADD CONSTRAINT "diet_assignments_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "InpatientAdmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "diet_assignments" ADD CONSTRAINT "diet_assignments_assigned_by_practitioner_id_fkey" FOREIGN KEY ("assigned_by_practitioner_id") REFERENCES "Practitioner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "WaitlistEntryStatus" AS ENUM ('OPEN', 'OFFERED', 'BOOKED', 'CANCELLED');

CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patient_ref_id" TEXT NOT NULL,
    "service_code" TEXT,
    "practitioner_id" TEXT,
    "preferred_from" DATE,
    "preferred_to" DATE,
    "status" "WaitlistEntryStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "waitlist_entries_status_preferred_from_idx" ON "waitlist_entries"("status", "preferred_from");
CREATE INDEX "waitlist_entries_patient_ref_id_idx" ON "waitlist_entries"("patient_ref_id");
CREATE INDEX "waitlist_entries_organizationId_idx" ON "waitlist_entries"("organizationId");

ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_patient_ref_id_fkey" FOREIGN KEY ("patient_ref_id") REFERENCES "PatientRef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "Practitioner"("id") ON DELETE SET NULL ON UPDATE CASCADE;