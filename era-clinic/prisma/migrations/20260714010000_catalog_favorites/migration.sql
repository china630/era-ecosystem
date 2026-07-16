-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "catalog_favorite_codes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "catalog_favorites_mode" TEXT NOT NULL DEFAULT 'first';
