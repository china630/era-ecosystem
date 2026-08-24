-- Cutover import keys + historical procedure flag (no folio / bonus).

ALTER TABLE "procedure_order" ADD COLUMN IF NOT EXISTS "imported_historical" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "cutover_import_key" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "external_ref" TEXT NOT NULL,
  "record_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cutover_import_key_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cutover_import_key_organization_id_entity_external_ref_key"
  ON "cutover_import_key"("organization_id", "entity", "external_ref");

CREATE INDEX IF NOT EXISTS "cutover_import_key_organization_id_idx"
  ON "cutover_import_key"("organization_id");
