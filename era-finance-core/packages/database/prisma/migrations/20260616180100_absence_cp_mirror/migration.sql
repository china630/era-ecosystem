-- v3 Plan A: Finance absence payroll mirror from CP events

CREATE TYPE "AbsenceSource" AS ENUM ('CP_EVENT', 'LEGACY_MANUAL');

ALTER TABLE "absences"
  ADD COLUMN "cp_absence_id" UUID,
  ADD COLUMN "cp_employment_id" UUID,
  ADD COLUMN "source" "AbsenceSource" NOT NULL DEFAULT 'CP_EVENT';

CREATE UNIQUE INDEX "absences_cp_absence_id_key" ON "absences"("cp_absence_id");
