-- Extra field registry + invoice JSONB extras (ADR extensibility W1). Not used in GL posting.

ALTER TABLE "invoices" ADD COLUMN "extra_attributes" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "extra_field_definitions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value_kind" TEXT NOT NULL,
    "catalog_field_kind" TEXT NOT NULL,
    "label_az" TEXT NOT NULL,
    "label_en" TEXT NOT NULL,
    "label_ru" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "options_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "extra_field_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "extra_field_definitions_organization_id_entity_type_key_key"
  ON "extra_field_definitions"("organization_id", "entity_type", "key");

CREATE INDEX "extra_field_definitions_organization_id_entity_type_active_idx"
  ON "extra_field_definitions"("organization_id", "entity_type", "active");

ALTER TABLE "extra_field_definitions"
  ADD CONSTRAINT "extra_field_definitions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
