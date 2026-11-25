-- Construction materials nomenclature (DH-MAT-CON-01)
CREATE TABLE IF NOT EXISTS "construction_materials" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" TEXT NOT NULL,
    "name_az" TEXT NOT NULL,
    "name_ru" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "uom_code" TEXT NOT NULL,
    "hs_code" TEXT,
    "class_path" TEXT,
    "indicative_price_azn" DECIMAL(19,4),
    "version" INTEGER NOT NULL DEFAULT 1,
    "effective_from" DATE NOT NULL DEFAULT CURRENT_DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "construction_materials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "construction_materials_code_key" ON "construction_materials"("code");
CREATE INDEX IF NOT EXISTS "construction_materials_uom_code_idx" ON "construction_materials"("uom_code");
CREATE INDEX IF NOT EXISTS "construction_materials_hs_code_idx" ON "construction_materials"("hs_code");

-- Enum value for ingest policy (Postgres ADD VALUE IF NOT EXISTS is PG 9.1+; use DO for safety)
DO $$ BEGIN
  ALTER TYPE "ReferenceCatalogKind" ADD VALUE IF NOT EXISTS 'CONSTRUCTION_MATERIALS';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
