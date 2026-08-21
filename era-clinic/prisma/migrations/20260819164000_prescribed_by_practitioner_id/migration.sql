-- W3 (CLI-45): doctor attribution for procedure reports/bonuses
ALTER TABLE "ProcedureOrder"
  ADD COLUMN IF NOT EXISTS "prescribed_by_practitioner_id" TEXT;

CREATE INDEX IF NOT EXISTS "ProcedureOrder_prescribed_by_practitioner_id_scheduledAt_idx"
  ON "ProcedureOrder"("prescribed_by_practitioner_id", "scheduledAt");

