-- Wave 4: LEAVE_ANNUAL, templates, context snapshot, per-org-type-year numbering, cancel columns
ALTER TYPE "WorkforcePersonnelOrderType" ADD VALUE IF NOT EXISTS 'LEAVE_ANNUAL';

CREATE TABLE IF NOT EXISTS "workforce_personnel_order_templates" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID,
  "holding_id" UUID,
  "type" "WorkforcePersonnelOrderType" NOT NULL,
  "locale" VARCHAR(8) NOT NULL,
  "name" TEXT NOT NULL,
  "body_html" TEXT NOT NULL,
  "placeholders" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workforce_personnel_order_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workforce_personnel_order_templates_organization_id_type_locale_idx"
  ON "workforce_personnel_order_templates"("organization_id", "type", "locale");
CREATE INDEX IF NOT EXISTS "workforce_personnel_order_templates_holding_id_type_locale_idx"
  ON "workforce_personnel_order_templates"("holding_id", "type", "locale");

ALTER TABLE "workforce_personnel_orders"
  ADD COLUMN IF NOT EXISTS "sequence_year" INTEGER,
  ADD COLUMN IF NOT EXISTS "sequence_seq" INTEGER,
  ADD COLUMN IF NOT EXISTS "locale" VARCHAR(8) NOT NULL DEFAULT 'az',
  ADD COLUMN IF NOT EXISTS "context_json" JSONB,
  ADD COLUMN IF NOT EXISTS "cancelled_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX IF NOT EXISTS "workforce_personnel_orders_org_type_year_seq_key"
  ON "workforce_personnel_orders"("organization_id", "type", "sequence_year", "sequence_seq");

CREATE INDEX IF NOT EXISTS "workforce_personnel_orders_employment_id_type_status_idx"
  ON "workforce_personnel_orders"("employment_id", "type", "status");

-- Partial uniques: org-scoped vs holding-scoped templates (NULL side excluded).
CREATE UNIQUE INDEX IF NOT EXISTS "wpot_org_type_locale_uniq"
  ON "workforce_personnel_order_templates"("organization_id", "type", "locale")
  WHERE "organization_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "wpot_holding_type_locale_uniq"
  ON "workforce_personnel_order_templates"("holding_id", "type", "locale")
  WHERE "holding_id" IS NOT NULL;
