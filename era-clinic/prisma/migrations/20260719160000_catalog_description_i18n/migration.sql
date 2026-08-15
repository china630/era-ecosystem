-- Service catalog multilingual commercial names (Finance sync / Nafta import)
ALTER TABLE "ServiceCatalogCache" ADD COLUMN IF NOT EXISTS "description_az" TEXT;
ALTER TABLE "ServiceCatalogCache" ADD COLUMN IF NOT EXISTS "description_ru" TEXT;
ALTER TABLE "ServiceCatalogCache" ADD COLUMN IF NOT EXISTS "description_en" TEXT;
