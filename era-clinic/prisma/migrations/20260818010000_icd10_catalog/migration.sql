-- CLI-39: full WHO ICD-10 catalog (drop legacy 8-row IcdCode + free-text diagnosis)

DELETE FROM "ClinicalDiagnosis";

DROP TABLE IF EXISTS "AdmissionDiagnosis";
DROP TABLE IF EXISTS "VisitDiagnosis";
DROP TABLE IF EXISTS "ClinicalDiagnosis";
DROP TABLE IF EXISTS "IcdCode";

DROP TYPE IF EXISTS "IcdCodeKind";
DROP TYPE IF EXISTS "DiagnosisRole";
DROP TYPE IF EXISTS "AdmissionDiagnosisKind";

CREATE TYPE "IcdCodeKind" AS ENUM ('CHAPTER', 'BLOCK', 'CATEGORY', 'LEAF');
CREATE TYPE "DiagnosisRole" AS ENUM ('PRIMARY', 'SECONDARY');
CREATE TYPE "AdmissionDiagnosisKind" AS ENUM ('ADMISSION', 'DISCHARGE');

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "icd_favorite_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "icd10_version" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "icd10_synced_at" TIMESTAMP(3);

CREATE TABLE "IcdCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "IcdCodeKind" NOT NULL,
    "chapter_code" TEXT NOT NULL,
    "block_code" TEXT NOT NULL,
    "parent_code" TEXT,
    "title_az" TEXT,
    "title_ru" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "search_text" TEXT NOT NULL,
    "selectable" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "retired_at" TIMESTAMP(3),

    CONSTRAINT "IcdCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IcdCode_code_key" ON "IcdCode"("code");
CREATE INDEX "IcdCode_kind_selectable_active_idx" ON "IcdCode"("kind", "selectable", "active");
CREATE INDEX "IcdCode_chapter_code_idx" ON "IcdCode"("chapter_code");

CREATE TABLE "ClinicalDiagnosis" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "icd_code_id" TEXT NOT NULL,
    "note" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_user_id" TEXT,

    CONSTRAINT "ClinicalDiagnosis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClinicalDiagnosis_episodeId_idx" ON "ClinicalDiagnosis"("episodeId");
CREATE INDEX "ClinicalDiagnosis_icd_code_id_idx" ON "ClinicalDiagnosis"("icd_code_id");

ALTER TABLE "ClinicalDiagnosis"
  ADD CONSTRAINT "ClinicalDiagnosis_episodeId_fkey"
  FOREIGN KEY ("episodeId") REFERENCES "ClinicalEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalDiagnosis"
  ADD CONSTRAINT "ClinicalDiagnosis_icd_code_id_fkey"
  FOREIGN KEY ("icd_code_id") REFERENCES "IcdCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "VisitDiagnosis" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL DEFAULT 'unbound',
    "visit_id" TEXT NOT NULL,
    "icd_code_id" TEXT NOT NULL,
    "role" "DiagnosisRole" NOT NULL DEFAULT 'PRIMARY',
    "note" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_user_id" TEXT,

    CONSTRAINT "VisitDiagnosis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VisitDiagnosis_visit_id_idx" ON "VisitDiagnosis"("visit_id");
CREATE INDEX "VisitDiagnosis_icd_code_id_idx" ON "VisitDiagnosis"("icd_code_id");
CREATE INDEX "VisitDiagnosis_organization_id_idx" ON "VisitDiagnosis"("organization_id");

ALTER TABLE "VisitDiagnosis"
  ADD CONSTRAINT "VisitDiagnosis_visit_id_fkey"
  FOREIGN KEY ("visit_id") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitDiagnosis"
  ADD CONSTRAINT "VisitDiagnosis_icd_code_id_fkey"
  FOREIGN KEY ("icd_code_id") REFERENCES "IcdCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AdmissionDiagnosis" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL DEFAULT 'unbound',
    "admission_id" TEXT NOT NULL,
    "icd_code_id" TEXT NOT NULL,
    "kind" "AdmissionDiagnosisKind" NOT NULL DEFAULT 'ADMISSION',
    "role" "DiagnosisRole" NOT NULL DEFAULT 'PRIMARY',
    "note" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_user_id" TEXT,

    CONSTRAINT "AdmissionDiagnosis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdmissionDiagnosis_admission_id_idx" ON "AdmissionDiagnosis"("admission_id");
CREATE INDEX "AdmissionDiagnosis_icd_code_id_idx" ON "AdmissionDiagnosis"("icd_code_id");
CREATE INDEX "AdmissionDiagnosis_organization_id_idx" ON "AdmissionDiagnosis"("organization_id");

ALTER TABLE "AdmissionDiagnosis"
  ADD CONSTRAINT "AdmissionDiagnosis_admission_id_fkey"
  FOREIGN KEY ("admission_id") REFERENCES "InpatientAdmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdmissionDiagnosis"
  ADD CONSTRAINT "AdmissionDiagnosis_icd_code_id_fkey"
  FOREIGN KEY ("icd_code_id") REFERENCES "IcdCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
