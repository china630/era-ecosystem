-- AlterTable
ALTER TABLE "fnb_org_profiles" ADD COLUMN IF NOT EXISTS "integration_settings_json" JSONB;
