-- SATELLITE_HOTEL_INVOICE_ISSUED: idempotency via hotel folio id
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "source_folio_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "invoice_source_folio_id_org_uidx"
  ON "invoices"("organization_id", "source_folio_id");

