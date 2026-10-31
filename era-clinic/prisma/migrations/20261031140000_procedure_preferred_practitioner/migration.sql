-- Guest-requested masseur on a procedure order. Null keeps automatic staff pick.
ALTER TABLE "ProcedureOrder" ADD COLUMN "preferred_practitioner_id" TEXT;

CREATE INDEX "ProcedureOrder_preferredPractitionerId_idx" ON "ProcedureOrder"("preferred_practitioner_id");

ALTER TABLE "ProcedureOrder" ADD CONSTRAINT "ProcedureOrder_preferred_practitioner_id_fkey" FOREIGN KEY ("preferred_practitioner_id") REFERENCES "Practitioner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
