-- Per-org clinic cutover policy (SaaS Super-Admin / Sync).
CREATE TABLE IF NOT EXISTS "clinic_cutover_policy" (
  "organization_id" TEXT NOT NULL,
  "elektraweb_dual_run" BOOLEAN NOT NULL DEFAULT false,
  "hotel_organization_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinic_cutover_policy_pkey" PRIMARY KEY ("organization_id")
);
