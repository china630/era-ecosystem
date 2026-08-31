-- Cutover idempotency key for EW POS Id / cheque Id.
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "external_ref" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "tickets_organization_id_external_ref_key"
  ON "tickets"("organization_id", "external_ref");
