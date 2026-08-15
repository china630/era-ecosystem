-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "default_procedure_gap_minutes" INTEGER NOT NULL DEFAULT 5;
