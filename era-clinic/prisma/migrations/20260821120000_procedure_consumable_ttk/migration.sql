-- Clinic procedure TTK (consumable BOM) → Finance inventory (CLI-47 W1)
CREATE TABLE IF NOT EXISTS "procedure_consumable_line" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL DEFAULT 'unbound',
    "procedure_type_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "finance_product_id" TEXT,
    "qty_per_session" DECIMAL(19,4) NOT NULL DEFAULT 1,
    "waste_factor" DECIMAL(19,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procedure_consumable_line_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "procedure_consumable_line_procedure_type_id_sku_key"
  ON "procedure_consumable_line"("procedure_type_id", "sku");

CREATE INDEX IF NOT EXISTS "procedure_consumable_line_procedure_type_id_idx"
  ON "procedure_consumable_line"("procedure_type_id");

CREATE INDEX IF NOT EXISTS "procedure_consumable_line_organization_id_idx"
  ON "procedure_consumable_line"("organization_id");

ALTER TABLE "procedure_consumable_line"
  ADD CONSTRAINT "procedure_consumable_line_procedure_type_id_fkey"
  FOREIGN KEY ("procedure_type_id") REFERENCES "ProcedureType"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
