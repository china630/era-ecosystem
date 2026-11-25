-- Smeta rate engine MVP (SKU construction_smeta_rate_engine)
CREATE TABLE IF NOT EXISTS "rate_bases" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rate_bases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "rate_bases_organization_id_code_version_key"
  ON "rate_bases"("organization_id", "code", "version");
CREATE INDEX IF NOT EXISTS "rate_bases_organization_id_idx" ON "rate_bases"("organization_id");

CREATE TABLE IF NOT EXISTS "rate_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "rate_base_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'ед.',
    "kind" TEXT NOT NULL DEFAULT 'COMPOSITE',
    "unit_amount" DECIMAL(14,4) NOT NULL,
    "material_code" TEXT,
    "composition_json" TEXT NOT NULL DEFAULT '[]',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rate_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "rate_items_rate_base_id_code_key" ON "rate_items"("rate_base_id", "code");
CREATE INDEX IF NOT EXISTS "rate_items_organization_id_idx" ON "rate_items"("organization_id");
CREATE INDEX IF NOT EXISTS "rate_items_code_idx" ON "rate_items"("code");

DO $$ BEGIN
  ALTER TABLE "rate_items"
    ADD CONSTRAINT "rate_items_rate_base_id_fkey"
    FOREIGN KEY ("rate_base_id") REFERENCES "rate_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
