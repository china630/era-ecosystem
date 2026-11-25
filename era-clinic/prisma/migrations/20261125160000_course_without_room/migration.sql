-- CLI-69: ambulatory / staff benefit courses without a hotel room
CREATE TYPE "ClinicalCourseKind" AS ENUM ('AMBULATORY', 'STAFF_BENEFIT');

ALTER TABLE "ClinicalEpisode" ADD COLUMN "course_kind" "ClinicalCourseKind";
ALTER TABLE "ClinicalEpisode" ADD COLUMN "planned_ends_on" TIMESTAMP(3);
ALTER TABLE "ClinicalEpisode" ADD COLUMN "benefit_employment_id" TEXT;

CREATE INDEX "ClinicalEpisode_organizationId_course_kind_status_idx" ON "ClinicalEpisode"("organizationId", "course_kind", "status");
CREATE INDEX "ClinicalEpisode_benefit_employment_id_idx" ON "ClinicalEpisode"("benefit_employment_id");
