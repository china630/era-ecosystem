-- CreateEnum
CREATE TYPE "ClinicalNoteKind" AS ENUM ('VISIT_EXAM', 'ADMISSION_EXAM', 'DAILY_DIARY', 'STAGE_EPICRISIS', 'DISCHARGE_SUMMARY', 'CONSULTATION');

-- CreateEnum
CREATE TYPE "ClinicalNoteStatus" AS ENUM ('DRAFT', 'SIGNED', 'AMENDED');

-- CreateTable
CREATE TABLE "ClinicalNoteTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title_json" TEXT NOT NULL,
    "specialty" TEXT,
    "sections_json" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalNoteTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalNote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "visit_id" TEXT,
    "clinical_episode_id" TEXT,
    "admission_id" TEXT,
    "patient_ref_id" TEXT NOT NULL,
    "author_practitioner_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "template_version" INTEGER NOT NULL,
    "kind" "ClinicalNoteKind" NOT NULL,
    "payload_json" TEXT NOT NULL,
    "status" "ClinicalNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "signed_at" TIMESTAMP(3),
    "signed_by_user_id" TEXT,
    "amends_note_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalNoteTemplate_organizationId_code_key" ON "ClinicalNoteTemplate"("organizationId", "code");

-- CreateIndex
CREATE INDEX "ClinicalNoteTemplate_organizationId_is_active_idx" ON "ClinicalNoteTemplate"("organizationId", "is_active");

-- CreateIndex
CREATE INDEX "ClinicalNote_visit_id_status_idx" ON "ClinicalNote"("visit_id", "status");

-- CreateIndex
CREATE INDEX "ClinicalNote_patient_ref_id_created_at_idx" ON "ClinicalNote"("patient_ref_id", "created_at");

-- CreateIndex
CREATE INDEX "ClinicalNote_clinical_episode_id_idx" ON "ClinicalNote"("clinical_episode_id");

-- CreateIndex
CREATE INDEX "ClinicalNote_admission_id_idx" ON "ClinicalNote"("admission_id");

-- CreateIndex
CREATE INDEX "ClinicalNote_organizationId_idx" ON "ClinicalNote"("organizationId");

-- CreateIndex
CREATE INDEX "ClinicalNote_template_id_idx" ON "ClinicalNote"("template_id");

-- CreateIndex
CREATE INDEX "ClinicalNote_amends_note_id_idx" ON "ClinicalNote"("amends_note_id");

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_clinical_episode_id_fkey" FOREIGN KEY ("clinical_episode_id") REFERENCES "ClinicalEpisode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "InpatientAdmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_patient_ref_id_fkey" FOREIGN KEY ("patient_ref_id") REFERENCES "PatientRef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_author_practitioner_id_fkey" FOREIGN KEY ("author_practitioner_id") REFERENCES "Practitioner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "ClinicalNoteTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_amends_note_id_fkey" FOREIGN KEY ("amends_note_id") REFERENCES "ClinicalNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;