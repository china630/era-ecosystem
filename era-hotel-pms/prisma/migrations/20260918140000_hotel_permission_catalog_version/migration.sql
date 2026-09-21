-- Wave 1: one-shot additive permission catalog version for Role JSON remaps.
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "permissionCatalogVersion" INTEGER NOT NULL DEFAULT 0;
