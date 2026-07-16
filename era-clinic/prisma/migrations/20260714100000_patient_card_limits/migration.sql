-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "patient_card_results_preview" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "patient_card_plan_preview" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "patient_card_history_page_size" INTEGER NOT NULL DEFAULT 25;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "patient_card_plan_page_size" INTEGER NOT NULL DEFAULT 25;
