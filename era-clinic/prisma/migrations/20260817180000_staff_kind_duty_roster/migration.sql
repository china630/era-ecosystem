-- CLI-38: practitioner staffKind + monthly duty roster + clinic absences

CREATE TYPE "PractitionerStaffKind" AS ENUM ('DOCTOR', 'NURSE', 'LAB');
CREATE TYPE "StaffDutyRosterStatus" AS ENUM ('DRAFT', 'APPROVED');
CREATE TYPE "StaffAbsenceKind" AS ENUM ('VACATION', 'SICK', 'TRAINING', 'OTHER');

ALTER TABLE "Practitioner" ADD COLUMN "staff_kind" "PractitionerStaffKind" NOT NULL DEFAULT 'DOCTOR';

UPDATE "Practitioner" SET "staff_kind" = 'NURSE'
WHERE "specialty" ILIKE '%nurse%'
   OR "specialty" ILIKE '%медсестр%'
   OR "specialty" ILIKE '%bacı%'
   OR "specialty" ILIKE '%baci%'
   OR "code" ILIKE 'NURSE%'
   OR "code" ILIKE 'NR-%';

UPDATE "Practitioner" SET "staff_kind" = 'LAB'
WHERE "staff_kind" = 'DOCTOR'
  AND (
    "specialty" ILIKE '%lab%'
    OR "specialty" ILIKE '%лаборант%'
    OR "code" ILIKE 'LAB%'
  );

UPDATE "Practitioner" p
SET "staff_kind" = 'NURSE'
FROM "User" u
JOIN "Role" r ON r.id = u."roleId"
WHERE p."user_id" = u.id
  AND r.code = 'NURSE'
  AND p."staff_kind" = 'DOCTOR';

UPDATE "Practitioner" p
SET "staff_kind" = 'LAB'
FROM "User" u
JOIN "Role" r ON r.id = u."roleId"
WHERE p."user_id" = u.id
  AND r.code IN ('LAB_TECH', 'LAB')
  AND p."staff_kind" = 'DOCTOR';

CREATE INDEX "Practitioner_staff_kind_idx" ON "Practitioner"("staff_kind");

CREATE TABLE "staff_duty_roster" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL DEFAULT 'unbound',
    "year_month" TEXT NOT NULL,
    "staff_kind" "PractitionerStaffKind" NOT NULL DEFAULT 'NURSE',
    "status" "StaffDutyRosterStatus" NOT NULL DEFAULT 'DRAFT',
    "approved_at" TIMESTAMP(3),
    "approved_by_user_id" TEXT,
    "copied_from_year_month" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_duty_roster_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_duty_roster_organization_id_year_month_staff_kind_key"
  ON "staff_duty_roster"("organization_id", "year_month", "staff_kind");
CREATE INDEX "staff_duty_roster_organization_id_idx" ON "staff_duty_roster"("organization_id");

CREATE TABLE "staff_duty_line" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL DEFAULT 'unbound',
    "roster_id" TEXT NOT NULL,
    "procedure_type_id" TEXT NOT NULL,
    "practitioner_id" TEXT,
    "stable" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_duty_line_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_duty_line_roster_id_procedure_type_id_key"
  ON "staff_duty_line"("roster_id", "procedure_type_id");
CREATE INDEX "staff_duty_line_practitioner_id_idx" ON "staff_duty_line"("practitioner_id");
CREATE INDEX "staff_duty_line_organization_id_idx" ON "staff_duty_line"("organization_id");

ALTER TABLE "staff_duty_line"
  ADD CONSTRAINT "staff_duty_line_roster_id_fkey"
  FOREIGN KEY ("roster_id") REFERENCES "staff_duty_roster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_duty_line"
  ADD CONSTRAINT "staff_duty_line_procedure_type_id_fkey"
  FOREIGN KEY ("procedure_type_id") REFERENCES "ProcedureType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_duty_line"
  ADD CONSTRAINT "staff_duty_line_practitioner_id_fkey"
  FOREIGN KEY ("practitioner_id") REFERENCES "Practitioner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "staff_absence" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL DEFAULT 'unbound',
    "practitioner_id" TEXT NOT NULL,
    "kind" "StaffAbsenceKind" NOT NULL,
    "starts_on" TIMESTAMP(3) NOT NULL,
    "ends_on" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_absence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "staff_absence_practitioner_id_starts_on_ends_on_idx"
  ON "staff_absence"("practitioner_id", "starts_on", "ends_on");
CREATE INDEX "staff_absence_organization_id_idx" ON "staff_absence"("organization_id");

ALTER TABLE "staff_absence"
  ADD CONSTRAINT "staff_absence_practitioner_id_fkey"
  FOREIGN KEY ("practitioner_id") REFERENCES "Practitioner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
