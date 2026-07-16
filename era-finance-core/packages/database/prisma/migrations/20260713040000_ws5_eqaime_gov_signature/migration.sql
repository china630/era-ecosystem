-- WS5: Invoice e-qaimə fields + NetworkDocument DVX ingest payload

DO $eqaime_enum$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EqaimeStatus') THEN
    CREATE TYPE "EqaimeStatus" AS ENUM (
      'DRAFT',
      'READY',
      'SUBMITTED',
      'ACCEPTED',
      'REJECTED',
      'ERROR'
    );
  END IF;
END
$eqaime_enum$;

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "eqaime_number" TEXT,
  ADD COLUMN IF NOT EXISTS "eqaime_status" "EqaimeStatus",
  ADD COLUMN IF NOT EXISTS "eqaime_submitted_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "invoices_org_eqaime_status_idx"
  ON "invoices" ("organization_id", "eqaime_status");

ALTER TABLE "network_documents"
  ADD COLUMN IF NOT EXISTS "eqaime_payload" JSONB;
