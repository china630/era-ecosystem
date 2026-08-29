-- ProcedureOrder is the Prisma default table name (no @@map).
-- 20260823120000_cutover_import_keys targeted "procedure_order" and is a no-op
-- on DBs that were baselined or never applied that ALTER.

ALTER TABLE "ProcedureOrder" ADD COLUMN IF NOT EXISTS "imported_historical" BOOLEAN NOT NULL DEFAULT false;

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
