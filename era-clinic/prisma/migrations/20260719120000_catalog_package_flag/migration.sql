ALTER TABLE "ServiceCatalogCache" ADD COLUMN IF NOT EXISTS "package_included" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ServiceCatalogCache" ADD COLUMN IF NOT EXISTS "department" TEXT;
