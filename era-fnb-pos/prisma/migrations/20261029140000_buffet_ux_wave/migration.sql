-- Buffet UX wave: template kind/notes, management eaters roster

CREATE TYPE "BuffetTemplateKind" AS ENUM ('GUEST', 'STAFF');

ALTER TABLE "buffet_week_templates"
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "kind" "BuffetTemplateKind" NOT NULL DEFAULT 'GUEST';

DROP INDEX IF EXISTS "buffet_week_templates_organization_id_outlet_id_idx";
CREATE INDEX "buffet_week_templates_organization_id_outlet_id_kind_idx"
  ON "buffet_week_templates"("organization_id", "outlet_id", "kind");

CREATE TABLE IF NOT EXISTS "buffet_management_eaters" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "outlet_id" TEXT,
  "employment_id" TEXT,
  "global_person_id" TEXT,
  "display_label" TEXT NOT NULL,
  "included" BOOLEAN NOT NULL DEFAULT true,
  "source" TEXT NOT NULL DEFAULT 'HR',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "buffet_management_eaters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "buffet_management_eaters_organization_id_employment_id_key"
  ON "buffet_management_eaters"("organization_id", "employment_id");
CREATE INDEX IF NOT EXISTS "buffet_management_eaters_organization_id_included_idx"
  ON "buffet_management_eaters"("organization_id", "included");

ALTER TABLE "buffet_management_eaters"
  ADD CONSTRAINT "buffet_management_eaters_outlet_id_fkey"
  FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "buffet_management_meals"
  ADD COLUMN IF NOT EXISTS "eater_id" TEXT;

ALTER TABLE "buffet_management_meals"
  ADD CONSTRAINT "buffet_management_meals_eater_id_fkey"
  FOREIGN KEY ("eater_id") REFERENCES "buffet_management_eaters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
