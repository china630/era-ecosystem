-- WS7: Subconto analytical dimensions (BRANCH multi-branch)
CREATE TYPE "SubcontoKind" AS ENUM (
  'COUNTERPARTY',
  'PROJECT',
  'COST_CENTER',
  'ITEM',
  'EMPLOYEE',
  'CUSTOM'
);

CREATE TABLE "subconto_types" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "SubcontoKind" NOT NULL,
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subconto_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subconto_types_organization_id_code_key" ON "subconto_types"("organization_id", "code");
CREATE INDEX "subconto_types_organization_id_kind_idx" ON "subconto_types"("organization_id", "kind");
ALTER TABLE "subconto_types" ADD CONSTRAINT "subconto_types_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "account_subconto_configs" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "account_id" UUID NOT NULL,
  "subconto_type_id" UUID NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "account_subconto_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_subconto_configs_account_id_sort_order_key" ON "account_subconto_configs"("account_id", "sort_order");
CREATE UNIQUE INDEX "account_subconto_configs_account_id_subconto_type_id_key" ON "account_subconto_configs"("account_id", "subconto_type_id");
CREATE INDEX "account_subconto_configs_organization_id_account_id_idx" ON "account_subconto_configs"("organization_id", "account_id");
ALTER TABLE "account_subconto_configs" ADD CONSTRAINT "account_subconto_configs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_subconto_configs" ADD CONSTRAINT "account_subconto_configs_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_subconto_configs" ADD CONSTRAINT "account_subconto_configs_subconto_type_id_fkey"
  FOREIGN KEY ("subconto_type_id") REFERENCES "subconto_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "journal_entry_dimensions" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "journal_entry_id" UUID NOT NULL,
  "subconto_type_id" UUID NOT NULL,
  "value_id" UUID,
  "value_ref" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "journal_entry_dimensions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "journal_entry_dimensions_journal_entry_id_idx" ON "journal_entry_dimensions"("journal_entry_id");
CREATE INDEX "journal_entry_dimensions_subconto_type_id_value_id_idx" ON "journal_entry_dimensions"("subconto_type_id", "value_id");
CREATE INDEX "journal_entry_dimensions_subconto_type_id_value_ref_idx" ON "journal_entry_dimensions"("subconto_type_id", "value_ref");
ALTER TABLE "journal_entry_dimensions" ADD CONSTRAINT "journal_entry_dimensions_journal_entry_id_fkey"
  FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journal_entry_dimensions" ADD CONSTRAINT "journal_entry_dimensions_subconto_type_id_fkey"
  FOREIGN KEY ("subconto_type_id") REFERENCES "subconto_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
