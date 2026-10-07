-- Bath attendants and massage therapists, and several monthly posts per procedure.
-- PostgreSQL UNIQUE treats NULL practitioner_id as distinct, so the open
-- (unassigned) post is limited by a partial unique index.

ALTER TYPE "PractitionerStaffKind" ADD VALUE IF NOT EXISTS 'BATH';
ALTER TYPE "PractitionerStaffKind" ADD VALUE IF NOT EXISTS 'MASSAGE';

DROP INDEX IF EXISTS "staff_duty_line_roster_id_procedure_type_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "staff_duty_line_roster_id_procedure_type_id_practitioner_id_key"
  ON "staff_duty_line"("roster_id", "procedure_type_id", "practitioner_id");

CREATE UNIQUE INDEX IF NOT EXISTS "staff_duty_line_one_open_post"
  ON "staff_duty_line"("roster_id", "procedure_type_id")
  WHERE "practitioner_id" IS NULL;
