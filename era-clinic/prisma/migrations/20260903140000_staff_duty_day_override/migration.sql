-- CLI-38b: head-doctor day substitution for monthly duty roster

CREATE TABLE "staff_duty_day_override" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL DEFAULT 'unbound',
    "roster_id" TEXT NOT NULL,
    "duty_date" TIMESTAMP(3) NOT NULL,
    "procedure_type_id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "note" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_duty_day_override_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_duty_day_override_roster_id_duty_date_procedure_type_id_key"
  ON "staff_duty_day_override"("roster_id", "duty_date", "procedure_type_id");
CREATE INDEX "staff_duty_day_override_organization_id_duty_date_idx"
  ON "staff_duty_day_override"("organization_id", "duty_date");
CREATE INDEX "staff_duty_day_override_practitioner_id_idx"
  ON "staff_duty_day_override"("practitioner_id");

ALTER TABLE "staff_duty_day_override"
  ADD CONSTRAINT "staff_duty_day_override_roster_id_fkey"
  FOREIGN KEY ("roster_id") REFERENCES "staff_duty_roster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_duty_day_override"
  ADD CONSTRAINT "staff_duty_day_override_procedure_type_id_fkey"
  FOREIGN KEY ("procedure_type_id") REFERENCES "ProcedureType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_duty_day_override"
  ADD CONSTRAINT "staff_duty_day_override_practitioner_id_fkey"
  FOREIGN KEY ("practitioner_id") REFERENCES "Practitioner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
