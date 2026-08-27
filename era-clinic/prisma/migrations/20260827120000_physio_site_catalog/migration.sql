-- Physio S catalog + device program / substance lists (CLI-49 W1).
-- Retire sites via active=false; do not DROP rows.

ALTER TABLE "ProcedureType" ADD COLUMN IF NOT EXISTS "needs_site" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProcedureType" ADD COLUMN IF NOT EXISTS "physio_order_fields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

DO $$ BEGIN
  CREATE TYPE "PhysioListKind" AS ENUM ('DEVICE_PROGRAM', 'SUBSTANCE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "physio_site" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "prikaz_817" INTEGER,
  "laterality" BOOLEAN NOT NULL DEFAULT false,
  "title_az" TEXT NOT NULL,
  "title_ru" TEXT NOT NULL,
  "title_en" TEXT NOT NULL,
  "title_la" TEXT NOT NULL,
  "boundary" TEXT,
  "coarse" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "anatomy_json" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "physio_site_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "physio_site_organization_id_code_key"
  ON "physio_site"("organization_id", "code");
CREATE INDEX IF NOT EXISTS "physio_site_organization_id_active_sort_order_idx"
  ON "physio_site"("organization_id", "active", "sort_order");

CREATE TABLE IF NOT EXISTS "physio_site_alias" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "alias" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "physio_site_alias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "physio_site_alias_organization_id_alias_key"
  ON "physio_site_alias"("organization_id", "alias");
CREATE INDEX IF NOT EXISTS "physio_site_alias_site_id_idx"
  ON "physio_site_alias"("site_id");

DO $$ BEGIN
  ALTER TABLE "physio_site_alias"
    ADD CONSTRAINT "physio_site_alias_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "physio_site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "physio_list_item" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "list_kind" "PhysioListKind" NOT NULL,
  "code" TEXT NOT NULL,
  "title_az" TEXT NOT NULL,
  "title_ru" TEXT NOT NULL,
  "title_en" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "physio_list_item_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "physio_list_item_organization_id_list_kind_code_key"
  ON "physio_list_item"("organization_id", "list_kind", "code");
CREATE INDEX IF NOT EXISTS "physio_list_item_organization_id_list_kind_active_idx"
  ON "physio_list_item"("organization_id", "list_kind", "active");

CREATE TABLE IF NOT EXISTS "physio_list_alias" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "list_kind" "PhysioListKind" NOT NULL,
  "alias" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "physio_list_alias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "physio_list_alias_organization_id_list_kind_alias_key"
  ON "physio_list_alias"("organization_id", "list_kind", "alias");
CREATE INDEX IF NOT EXISTS "physio_list_alias_item_id_idx"
  ON "physio_list_alias"("item_id");

DO $$ BEGIN
  ALTER TABLE "physio_list_alias"
    ADD CONSTRAINT "physio_list_alias_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "physio_list_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
