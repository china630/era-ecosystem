-- Variant A: OpsRole grant matrix fields
ALTER TABLE "OpsRole" ADD COLUMN IF NOT EXISTS "permissions_json" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "OpsRole" ADD COLUMN IF NOT EXISTS "is_system" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OpsRole" ADD COLUMN IF NOT EXISTS "clone_from_code" TEXT;
ALTER TABLE "OpsRole" ADD COLUMN IF NOT EXISTS "permission_catalog_version" INTEGER NOT NULL DEFAULT 0;
