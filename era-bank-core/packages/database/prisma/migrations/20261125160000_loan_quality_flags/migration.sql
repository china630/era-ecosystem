-- AlterTable
ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "quality_flags_json" JSONB NOT NULL DEFAULT '[]';
